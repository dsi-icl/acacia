import express from 'express';
import bodyParser from 'body-parser';


export class Router {
    constructor() {
        const app = express();

        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));
        
        app.route('/login')
            .post()
        
        app.route('/logout')
            .post()

        app.route('/uploadJobs') //job?=1111 or /job
            .get() //get all the jobs the user has created or a specific job (including status)
            .post()  //create a new job  /
            .delete() //cancel a job    //GDPR?

        app.route('/users')
            .get()  //get all users  / a specific user
            .post() //create new user
            .patch()   //change user password / privilege etc
            .delete() //delete a user
        
        

        return app;
    }
}