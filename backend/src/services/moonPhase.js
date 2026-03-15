const SYNODIC_MONTH_DAYS = 29.53058867;
const KNOWN_NEW_MOON_JULIAN_DATE = 2451550.1;

function normalizeModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function toJulianDate(date) {
  return (date.getTime() / 86400000) + 2440587.5;
}

function getPhaseIndex(phaseFraction) {
  if (phaseFraction < 0.0625 || phaseFraction >= 0.9375) {
    return 0;
  }
  if (phaseFraction < 0.1875) {
    return 1;
  }
  if (phaseFraction < 0.3125) {
    return 2;
  }
  if (phaseFraction < 0.4375) {
    return 3;
  }
  if (phaseFraction < 0.5625) {
    return 4;
  }
  if (phaseFraction < 0.6875) {
    return 5;
  }
  if (phaseFraction < 0.8125) {
    return 6;
  }
  return 7;
}

function getPhaseDescriptor(phaseIndex) {
  const phases = [
    { name: 'New Moon', emoji: '🌑' },
    { name: 'Waxing Crescent', emoji: '🌒' },
    { name: 'First Quarter', emoji: '🌓' },
    { name: 'Waxing Gibbous', emoji: '🌔' },
    { name: 'Full Moon', emoji: '🌕' },
    { name: 'Waning Gibbous', emoji: '🌖' },
    { name: 'Last Quarter', emoji: '🌗' },
    { name: 'Waning Crescent', emoji: '🌘' },
  ];

  return phases[phaseIndex] || phases[0];
}

function formatDaysLabel(days) {
  if (days < 0.5) {
    return 'Tonight';
  }
  if (days < 1) {
    return 'Less than a day';
  }
  return `${days.toFixed(1)} days`;
}

class MoonPhaseService {
  getCurrentWidget(date = new Date()) {
    const julianDate = toJulianDate(date);
    const ageDays = normalizeModulo(julianDate - KNOWN_NEW_MOON_JULIAN_DATE, SYNODIC_MONTH_DAYS);
    const phaseFraction = ageDays / SYNODIC_MONTH_DAYS;
    const illuminationFraction = (1 - Math.cos(2 * Math.PI * phaseFraction)) / 2;
    const phaseIndex = getPhaseIndex(phaseFraction);
    const descriptor = getPhaseDescriptor(phaseIndex);
    const waxing = phaseFraction < 0.5;
    const daysUntilFull = normalizeModulo((0.5 - phaseFraction) * SYNODIC_MONTH_DAYS, SYNODIC_MONTH_DAYS);
    const daysUntilNew = normalizeModulo((1 - phaseFraction) * SYNODIC_MONTH_DAYS, SYNODIC_MONTH_DAYS);

    return {
      type: 'moon',
      title: 'Moon',
      status: 'ready',
      phaseName: descriptor.name,
      phaseEmoji: descriptor.emoji,
      phaseFraction,
      illuminationPercent: Math.round(illuminationFraction * 100),
      ageDays: Number(ageDays.toFixed(1)),
      waxing,
      nextFullLabel: formatDaysLabel(daysUntilFull),
      nextNewLabel: formatDaysLabel(daysUntilNew),
    };
  }
}

module.exports = new MoonPhaseService();
