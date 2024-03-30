import jwt from 'jsonwebtoken';
import { Config } from '../Config/config';
import { Request, Response, NextFunction } from 'express';
import passport from 'passport';


export function generateTokenWithRole(user: any, role: string) {
    const payload = {
        user: user,
        role: role
    };

    const token = jwt.sign(payload, Config.JWTSecret, { expiresIn: '1h' });
    return token;
}


export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
    passport.authenticate('jwt', { session: false }, (err: Error, user: any) => {
        if (err || !user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        req.user = user;
        next();
    })(req, res, next);
}

export function isEmail(email: string) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}