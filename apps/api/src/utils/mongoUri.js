/**
 * Compose a MongoDB connection URI for a specific database.
 *
 * The base MONGO_URI may carry a trailing path (e.g. "/admin") and a query
 * string (e.g. "?authSource=admin"). In the multi-tenant model the database
 * on the base URI is only a connection/auth endpoint — the tenant database
 * always replaces it. A naive `${uri}/${db}` corrupts the URI:
 *   "mongodb://host:27017/?authSource=admin" + "/<db>"
 *     -> "mongodb://host:27017/?authSource=admin/<db>"
 *     -> MongoServerError: Invalid database name: 'admin/<db>'
 *
 * This builds the URI by:
 *   1. Slicing off the query string (so options never break).
 *   2. Replacing any existing path after the host with "/<dbName>".
 *   3. Re-appending the query string.
 *
 * Examples:
 *   "mongodb://host:27017"                    -> "mongodb://host:27017/<db>"
 *   "mongodb://host:27017/?authSource=admin"  -> "mongodb://host:27017/<db>?authSource=admin"
 *   "mongodb://host:27017/admin"              -> "mongodb://host:27017/<db>"
 */
function buildDbUri(baseUri, dbName) {
  const qPos = baseUri.indexOf('?');
  const base = qPos === -1 ? baseUri : baseUri.slice(0, qPos);
  const query = qPos === -1 ? '' : baseUri.slice(qPos);

  // Host section ends at the first "/" after "://" (e.g. mongodb://host:27017).
  // Everything from there to the query string is the existing path to replace.
  const schemeEnd = base.indexOf('://');
  const firstSlash = schemeEnd === -1 ? -1 : base.indexOf('/', schemeEnd + 3);
  const origin = firstSlash === -1 ? base : base.slice(0, firstSlash);

  const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  return `${cleanOrigin}/${dbName}${query}`;
}

module.exports = { buildDbUri };
