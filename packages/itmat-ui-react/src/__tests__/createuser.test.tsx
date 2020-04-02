import React from 'react';
import { CreateNewUser } from '../components/users/createNewUser';
import { shallow, mount } from 'enzyme';
import { MockedProvider } from '@apollo/react-testing';
import { MemoryRouter } from 'react-router';
import ReactDOM from 'react-dom';
import { UploadFileSection } from '../components/datasetDetail/tabContent/files/uploadFile';

describe('Create new users', () => {
    it('mounts', () => {
        const wrapper = mount(
            <MemoryRouter initialEntries={['/']}>
                <MockedProvider mocks={[]}>
                    <CreateNewUser/>
                </MockedProvider>
            </MemoryRouter>
        );
        expect(wrapper.find('input')).toHaveLength(3);
    });

});
