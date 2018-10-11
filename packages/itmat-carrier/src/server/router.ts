import express from 'express';
import { Express, Request, Response, NextFunction } from 'express';
import { CarrierDatabase } from '../database/database';
import { CustomError, RequestValidationHelper, UserControllerBasic } from 'itmat-utils';
import { FileController } from '../controllers/fileController';
import bodyParser from 'body-parser';
import passport from 'passport';
import { UserUtils } from '../utils/userUtils';
import session from 'express-session';
import connectMongo from 'connect-mongo';
const MongoStore = connectMongo(session);
import multer from 'multer';

const upload = multer();

export class Router {
    constructor() {
        const app: Express = express();

        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));

        app.use(session({
            secret: 'IAmATeapot',
            store: new MongoStore({ db: CarrierDatabase.getDB() } as any)
        }));


        app.use(passport.initialize());
        app.use(passport.session());

        passport.serializeUser(UserUtils.serialiseUser);
        passport.deserializeUser(UserUtils.deserialiseUser);

        app.route('/whoAmI')
            .get(UserControllerBasic.whoAmI);

        app.use(RequestValidationHelper.bounceNotLoggedIn);
        // app.route('/data')
        //     .post(upload.fields([{ name: 'UKBCSVFile', maxCount: 1 }]), (req, res) => { console.log('file', (req.files as any).UKBCSVFile ); res.send('yes'); });  //TODO: check for undefined file;
            
        app.route('/fileUpload')
            .post(upload.single('file'), FileController.uploadFile);

        app.route('/fileDownload')
            .post(FileController.downloadFile);
        
        app.all('/', function(err: Error, req: Request, res: Response, next: NextFunction) {
            res.status(500).json(new CustomError('Server error.'));
        })

        return app;
    }
}