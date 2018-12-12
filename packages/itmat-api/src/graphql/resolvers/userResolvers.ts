import bcrypt from 'bcrypt';
import { UserInputError } from 'apollo-server-express';
import { Database } from '../../database/database';

export const userResolvers = {
    Query: {
        whoAmI(parent: object, args: any, context: any, info: any): object {
            return context.req.user;
        },
        // getUsers(parent: object, args: any, context: any, info: any): object[] {
        //     // check admin privilege
        //     if (args.username) {

        //     } else {

        //     }
        // },
        // getStudies(parent: object, args: any, context: any, info: any): object[] {
        //     // return only the studies the guy has access to.
        // }
    },
    Mutation: {
        login: async(parent: object, args: any, context: any, info: any): Promise<object> => {
            const { db, req }: { db: Database, req: Express.Request } = context;
            const result = await db.users_collection!.findOne({ deleted: false, username: args.username });
            if (!result) {
                throw new UserInputError('User does not exist.');
            }
            const passwordMatched = await bcrypt.compare(args.password, result.password);
            // const passwordMatched = req.body.password === result.password;
            if (!passwordMatched) {
                throw new UserInputError('Incorrect password.');
            }

            return new Promise(resolve => {
                req.login(result, (err: any) => {
                    if (err) { console.log(err); resolve({ error: true, loggedIn: false }); }
                    // res.status(200).json({ message: 'Logged in!' });
                    resolve({ error: false, loggedIn: true });
                });
            });
        }
    }
};