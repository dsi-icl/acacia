import React from 'react';
import { render } from '@testing-library/react';
import { RegisterNewUser } from '../components/login/register';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router';

describe('Create new users', () => {
    it('mounts', () => {
        const { container } = render(
            <MemoryRouter initialEntries={['/']}>
                <MockedProvider mocks={[]}>
                    <RegisterNewUser />
                </MockedProvider>
            </MemoryRouter>
        );
        const buttons = container.querySelectorAll('input')
        expect(buttons).toHaveLength(0);
    });

});
