import moment from 'moment';

const localFormat = moment.HTML5_FMT.DATETIME_LOCAL;

export function dateInputValue(value, type) {
  if (!value) return '';
  if (type === 'date') {
    const date = moment.utc(value, moment.ISO_8601, true);
    return date.isValid() ? date.format(moment.HTML5_FMT.DATE) : '';
  }
  if (type === 'datetime-local') {
    const date = moment(value, moment.ISO_8601, true);
    return date.isValid() ? date.format(localFormat) : '';
  }
  return String(value);
}

export function datetimePayload(value, original) {
  if (original && value === dateInputValue(original, 'datetime-local')) return original;
  const parsed = moment(value, localFormat, true);
  return parsed.isValid() && parsed.format(localFormat) === value ? parsed.toISOString() : undefined;
}

export function displayDate(value, type) {
  const date = type === 'date' ? moment.utc(value, moment.ISO_8601, true) : moment.parseZone(value, moment.ISO_8601, true);
  return date.isValid() ? date.format(type === 'date' ? 'll' : 'll, HH:mm [UTC]Z') : String(value);
}
