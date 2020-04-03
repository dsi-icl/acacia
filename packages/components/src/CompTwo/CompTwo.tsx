import React from 'react';
import './CompTwo.css';

import Three from '../CompThree';

const CompTwo: React.FC = () => {
    return (
        <div className="Comp">
            <h3>
                <span role="img" aria-label="Yarn Logo">
                    🐱
        </span>{' '}
        Comp Two
        <Three />
            </h3>
        </div >
    );
};

export default CompTwo;
