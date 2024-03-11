import config from '../config/index';
import jwt from 'jsonwebtoken';

export const newToken = (model) => {
  return jwt.sign({ id: model.id }, config.secret.jwt, {
    expiresIn: config.secret.jwtExp,
  });
};

export const verifyToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.secret.jwt, (err, payload) => {
      err ? reject(err) : resolve(payload);
    });
  });
};

export const guard = async (req, res, next) => {
  const header = req.header('authorization');
  if (typeof header !== undefined && header.startsWith('Bearer ')) {
    const token = header.split(' ')[1];

    try {
      const payload = await verifyToken(token);

      req.payload = payload;
      next();
    } catch (e) {
      res.status(401).send('Access Unauthorized 👎').end();
    }
  }
};
