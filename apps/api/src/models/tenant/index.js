// Package status/transition constants are owned by @courier/constants.
// Re-exported here so existing call sites that require this module keep working.
const {
  PACKAGE_STATUSES,
  PACKAGE_STATUS_LIST,
  STATUS_TRANSITIONS,
} = require('@courier/constants');

module.exports = { PACKAGE_STATUSES, PACKAGE_STATUS_LIST, STATUS_TRANSITIONS };
