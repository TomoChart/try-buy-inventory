function isSuperadmin(u) { return u?.role === 'SUPERADMIN'; }
function isCountryAdmin(u) { return u?.role === 'COUNTRY_ADMIN'; }

function requireSuperadmin(req, res, next) {
  if (!isSuperadmin(req.user)) return res.status(403).json({ error: 'Forbidden' });
  next();
}

function allowedCreateRole(requestor, desiredRole) {
  if (isSuperadmin(requestor)) return true;
  if (isCountryAdmin(requestor)) return desiredRole === 'OPERATOR';
  return false;
}

module.exports = {
  isSuperadmin,
  isCountryAdmin,
  requireSuperadmin,
  allowedCreateRole,
};
