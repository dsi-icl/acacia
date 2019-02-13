import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import { Editor } from './editor';

export const Query: React.FunctionComponent = props => {
    return (
        <div>
            <Switch>
                <Route path='/query' render={() => <Editor/>}/>                
            </Switch>
        </div>
    );
};