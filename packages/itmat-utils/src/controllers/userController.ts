import { Express, Request, Response, NextFunction } from 'express';

export class UserControllerBasic {
    public static whoAmI(req: Request, res: Response, next: NextFunction): void {
        if (!req.user || req.user.username === undefined) {
            res.status(404).json({ message: 'A unicorn, whose multitude is denominated a blessing, and which is Scotland\'s national animal.'});
            return;
        }
        res.status(200).json(req.user);
        return;
    }
}