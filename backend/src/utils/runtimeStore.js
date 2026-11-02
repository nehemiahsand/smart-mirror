const fs = require('fs');
const path = require('path');

class RuntimeStore {
  constructor(name, fallback) {
    this.file = path.join(
      process.env.NEXUS_DATA_DIR || path.join(__dirname, '../../data'),
      name,
    );
    this.fallback = fallback;
  }

  read() {
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return JSON.parse(JSON.stringify(this.fallback));
    }
  }

  write(value) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
      mode: 0o600,
    });
    fs.renameSync(temporary, this.file);
  }
}

module.exports = RuntimeStore;
