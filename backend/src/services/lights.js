const axios = require('axios');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const config = require('./nexusConfig');
const events = require('./nexusEvents');
const activity = require('./activity');
const { privateLookup, checkAddress } = require('../utils/privateNetwork');
const fail = require('../utils/serviceError');
const RuntimeStore = require('../utils/runtimeStore');

class LightsService {
  constructor() {
    this.states = new Map();
    this.sockets = new Map();
    this.interval = null;
    this.inflight = new Set();
    this.generation = 0;
    this.defaultPairs = new RuntimeStore('nexus-lighting-defaults.json', { version: 0 });
  }
  devices() {
    return config.get().devices.filter((device) => device.kind === 'wled');
  }
  list() {
    return this.devices().map((device) => ({
      ...device,
      ...(this.states.get(device.id) || {
        online: false,
        state: null,
        info: null,
        presets: {},
        error: device.address ? 'connecting' : 'not_configured',
      }),
    }));
  }
  groupPresets() { return config.get().groupPresets; }
  seedPairs() {
    if (this.defaultPairs.read().version >= 1) return;
    const lights = this.list();
    const desk = lights.find((l) => l.id === 'desk');
    const monitor = lights.find((l) => l.id === 'monitor');
    if (lights.length !== 2 || !desk?.presets || !monitor?.presets) return;
    const find = (light, name) => Object.entries(light.presets).find(([id, p]) => Number(id) > 0 && p?.n?.trim().toLowerCase() === name)?.[0];
    const definitions = [
      ['Star Wars', 'star wars', 'star wars'], ['Auburn', 'auburn', 'auburn'],
      ['GSW', 'gsw', 'gsw'], ['Daytime', 'daytime', 'daytime'],
      ['Rainbow / Gaming', 'rainbow', 'gaming'],
    ];
    const pairs = definitions.map(([name, a, b]) => ({ name, devices: { desk: Number(find(desk, a)), monitor: Number(find(monitor, b)) } }));
    // Wait for both authoritative preset lists; never guess by matching IDs.
    if (pairs.some((p) => !p.devices.desk || !p.devices.monitor)) return;
    const current = config.get();
    for (const pair of pairs) {
      if (current.groupPresets.length >= 8) break;
      if (!current.groupPresets.some((p) => p.name === pair.name || p.devices.desk === pair.devices.desk && p.devices.monitor === pair.devices.monitor)) current.groupPresets.push(pair);
    }
    config.save(current);
    this.defaultPairs.write({ version: 1 });
    events.emit('nexus_config', current);
  }
  async request(device, path, payload) {
    if (!device?.address) throw fail('device_not_configured', 503);
    checkAddress(device.address);
    try {
      const response = await axios({
        url: new URL(path, device.address).href,
        method: payload === undefined ? 'GET' : 'POST',
        data: payload,
        timeout: 3500,
        maxRedirects: 0,
        proxy: false,
        maxContentLength: 262144,
        maxBodyLength: 16384,
        httpAgent: new http.Agent({ lookup: privateLookup }),
        httpsAgent: new https.Agent({
          lookup: privateLookup,
          rejectUnauthorized: true,
        }),
      });
      return response.data;
    } catch (error) {
      throw fail(
        error.code === 'device_address_not_private'
          ? error.code
          : 'wled_unreachable',
        503,
      );
    }
  }
  receive(device, data) {
    if (
      !data ||
      !data.state ||
      typeof data.state.on !== 'boolean' ||
      !Number.isInteger(data.state.bri) ||
      data.state.bri < 0 ||
      data.state.bri > 255
    )
      return false;
    const previous = this.states.get(device.id);
    this.states.set(device.id, {
      ...previous,
      online: true,
      state: data.state,
      info: data.info || previous?.info || {},
      updatedAt: Date.now(),
      error: null,
    });
    if (previous?.online === false)
      activity.record(device.id, `${device.name} connected`);
    events.emit('lights_state', this.list());
    return true;
  }
  offline(device) {
    const previous = this.states.get(device.id);
    this.states.set(device.id, {
      ...previous,
      online: false,
      error: device.address ? 'wled_unreachable' : 'not_configured',
    });
    if (previous?.online)
      activity.record(device.id, `${device.name} disconnected`, 'warning');
    events.emit('lights_state', this.list());
  }
  async refresh(device) {
    if (!device.address || this.inflight.has(device.id)) return;
    this.inflight.add(device.id);
    const generation = this.generation;
    try {
      const data = await this.request(device, '/json/si');
      if (generation !== this.generation) return;
      if (!this.receive(device, data)) throw fail('invalid_wled_state');
      if (
        !this.states.get(device.id).presets ||
        Date.now() - (this.states.get(device.id).presetsUpdatedAt || 0) > 60000
      ) {
        const presets = await this.request(device, '/presets.json').catch(
          () => ({}),
        );
        if (generation !== this.generation) return;
        this.states.set(device.id, {
          ...this.states.get(device.id),
          presets,
          presetsUpdatedAt: Date.now(),
        });
      }
      this.seedPairs();
      this.connect(device);
    } catch (_) {
      if (generation === this.generation) this.offline(device);
    } finally {
      if (generation === this.generation) this.inflight.delete(device.id);
    }
  }
  connect(device) {
    if (this.sockets.has(device.id)) return;
    try {
      checkAddress(device.address);
      const url = new URL('/ws', device.address);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(url, {
        lookup: privateLookup,
        handshakeTimeout: 3500,
        maxPayload: 262144,
        followRedirects: false,
      });
      this.sockets.set(device.id, socket);
      socket.on('message', (data) => {
        try {
          if (this.sockets.get(device.id) === socket)
            this.receive(device, JSON.parse(data.toString()));
        } catch (_) {
          /* Ignore invalid frames. */
        }
      });
      socket.on('error', () => socket.terminate());
      socket.on('close', () => {
        if (this.sockets.get(device.id) === socket)
          this.sockets.delete(device.id);
      });
    } catch (_) {
      /* Bounded polling remains the fallback. */
    }
  }
  initialize() {
    this.devices().forEach((device) => this.refresh(device));
    this.interval = setInterval(
      () => this.devices().forEach((device) => this.refresh(device)),
      10000,
    );
    this.interval.unref();
  }
  reconfigure() {
    this.generation++;
    for (const socket of this.sockets.values()) socket.terminate();
    this.sockets.clear();
    this.states.clear();
    this.inflight.clear();
    this.devices().forEach((device) => this.refresh(device));
    events.emit('lights_state', this.list());
  }
  async command(id, command) {
    const device = this.devices().find((d) => d.id === id);
    if (!device) throw fail('device_not_found', 404);
    if (
      !command ||
      Array.isArray(command) ||
      Object.keys(command).some(
        (key) =>
          !['on', 'brightness', 'color', 'presetId', 'restart'].includes(key),
      ) ||
      !Object.keys(command).length
    )
      throw fail('invalid_light_command');
    if (command.on !== undefined && typeof command.on !== 'boolean')
      throw fail('invalid_power');
    if (
      command.brightness !== undefined &&
      (!Number.isInteger(command.brightness) ||
        command.brightness < 0 ||
        command.brightness > 100)
    )
      throw fail('invalid_brightness');
    if (command.color !== undefined && !/^#[a-f0-9]{6}$/i.test(command.color))
      throw fail('invalid_color');
    if (
      command.presetId !== undefined &&
      (!Number.isInteger(command.presetId) ||
        command.presetId < 1 ||
        command.presetId > 250)
    )
      throw fail('invalid_preset');
    if (command.restart !== undefined && command.restart !== true)
      throw fail('invalid_restart');
    const before = this.states.get(id);
    if (!before?.online) throw fail('device_offline', 503);
    const payload = { v: true };
    if (command.on !== undefined) payload.on = command.on;
    if (command.brightness !== undefined) {
      payload.bri = Math.round((command.brightness * 255) / 100);
      payload.on =
        command.on ?? (command.brightness === 0 ? false : before.state.on);
    }
    if (command.presetId !== undefined) payload.ps = command.presetId;
    if (command.color !== undefined) {
      payload.on = command.on ?? before.state.on;
      const rgb = command.color
        .slice(1)
        .match(/../g)
        .map((hex) => parseInt(hex, 16));
      const segments = (before.state.seg || []).filter(
        (segment) => segment.stop > segment.start,
      );
      payload.seg = segments.map((segment, index) => ({
        id: segment.id ?? index,
        col: [[...rgb, 0]],
        fx: 0,
      }));
      if (!segments.length) throw fail('no_active_segments', 409);
    }
    if (command.restart) payload.rb = true;
    let response;
    try {
      response = await this.request(device, '/json/state', payload);
    } catch (error) {
      activity.record(id, `${device.name}: lighting command failed (${error.code || 'unreachable'})`, 'error');
      throw error;
    }
    if (response?.error !== undefined || response?.success === false) {
      activity.record(id, `${device.name}: WLED rejected the command`, 'error');
      throw fail('wled_rejected', 409);
    }
    if (!command.restart) {
      const snapshot = response?.state
        ? response
        : { state: response, info: before.info };
      if (!this.receive(device, snapshot)) await this.refresh(device);
    }
    activity.record(
      id,
      command.restart
        ? `${device.name} restart requested`
        : `${device.name} lighting updated`,
    );
    return this.list().find((d) => d.id === id);
  }
  async group(command) {
    const devices = this.devices();
    if (!devices.length) throw fail('no_lights_configured');
    let paired;
    if (command.groupPreset !== undefined) {
      if (Object.keys(command).length !== 1)
        throw fail('invalid_group_command');
      paired = config
        .get()
        .groupPresets.find((preset) => preset.name === command.groupPreset);
      if (!paired) throw fail('group_preset_not_found', 404);
    }
    const results = await Promise.all(
      devices.map(async (device) => {
        try {
          const state = await this.command(
            device.id,
            paired ? { presetId: paired.devices[device.id] } : command,
          );
          return { id: device.id, ok: true, state };
        } catch (error) {
          return {
            id: device.id,
            ok: false,
            error: error.code || 'wled_failed',
          };
        }
      }),
    );
    return { ok: results.every((result) => result.ok), results };
  }
  close() {
    clearInterval(this.interval);
    for (const socket of this.sockets.values()) socket.terminate();
    this.sockets.clear();
  }
}
module.exports = new LightsService();
module.exports.LightsService = LightsService;
