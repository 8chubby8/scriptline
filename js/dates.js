'use strict';

// Scriptline's own date format: { year, era: 'BCE'|'CE', precision: 'year'|'month'|'day', month?, day?, approx }.
// Browser dates are never used for historical dates (no year zero, forced day and timezone).
//
// For drawing, dates become a continuous "axis value" in years:
//   0 is the start of 1 CE, -1 is the start of 1 BCE — so there is no year zero.
const SLDates = (() => {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  const MONTHS_SHORT = MONTHS.map(m => m.slice(0, 3));
  const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const base = d => (d.era === 'CE' ? d.year - 1 : -d.year);

  // Axis value at the very start of the period the date names.
  function startValue(d) {
    let v = base(d);
    if (d.precision !== 'year' && d.month) {
      v += (d.month - 1) / 12;
      if (d.precision === 'day' && d.day) v += (d.day - 1) / (12 * DIM[d.month - 1]);
    }
    return v;
  }

  // Axis value at the very end of the period the date names ("701 BCE" runs to the end of that year).
  function endValue(d) {
    const v = base(d);
    if (d.precision === 'year' || !d.month) return v + 1;
    const m = v + (d.month - 1) / 12;
    if (d.precision === 'month' || !d.day) return m + 1 / 12;
    return m + d.day / (12 * DIM[d.month - 1]);
  }

  const eraName = (era, style) => (style === 'BC' ? (era === 'BCE' ? 'BC' : 'AD') : era);

  function format(d, style, withEra = true) {
    let s = '';
    if (d.precision === 'day' && d.month && d.day) s += d.day + ' ';
    if (d.precision !== 'year' && d.month) s += MONTHS[d.month - 1] + ' ';
    s += d.year;
    if (withEra) s += ' ' + eraName(d.era, style);
    return d.approx ? 'c. ' + s : s;
  }

  function formatRange(a, b, style) {
    if (!b) return format(a, style);
    return format(a, style, a.era !== b.era) + ' – ' + format(b, style);
  }

  // The year that begins at whole axis value v.
  const yearAt = v => (v >= 0 ? { year: v + 1, era: 'CE' } : { year: -v, era: 'BCE' });

  function isValid(d) {
    if (!d || !Number.isInteger(d.year) || d.year < 1) return false;
    if (d.precision !== 'year' && !(d.month >= 1 && d.month <= 12)) return false;
    if (d.precision === 'day' && !(d.day >= 1 && d.day <= DIM[d.month - 1] + (d.month === 2 ? 1 : 0))) return false;
    return true;
  }

  return { MONTHS, MONTHS_SHORT, DIM, startValue, endValue, eraName, format, formatRange, yearAt, isValid };
})();
