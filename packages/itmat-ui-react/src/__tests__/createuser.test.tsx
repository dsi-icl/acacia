import React from 'react';
import { render, screen } from '@testing-library/react';
import { RegisterNewUser } from '../components/login/register';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router';

describe('Create new users', () => {
    it('mounts', () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <MockedProvider mocks={[]}>
                    <RegisterNewUser />
                </MockedProvider>
            </MemoryRouter>
        );
        expect(screen.getByText(/./)).toBeInTheDocument();
    });

});
