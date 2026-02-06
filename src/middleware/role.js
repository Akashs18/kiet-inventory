export const allow = (...roles) => {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).send("Unauthorized");
    }

    if (!roles.includes(req.session.user.role)) {
      return res.status(403).send("Forbidden");
    }

    next();
  };
};
