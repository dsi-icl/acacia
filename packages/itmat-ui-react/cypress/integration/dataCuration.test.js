/// <reference types="cypress" />
const { LOGIN_BODY_ADMIN } = require('../fixtures/loginstring');
const { CREATE_STUDY, UPLOAD_FILE } = require('itmat-commons').GQLRequests;
const { print } = require('graphql');
const { v4: uuid } = require('uuid');

describe('File upload page', function () {
    it('Admin can load data from a selected file', function () {
        cy.fixture('CSVCurator.tsv').as('file');

        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        /* setup: create a study via API */
        const createStudyInput = { name: uuid() };
        cy.request('POST', 'http://localhost:3003/graphql',
            { query: print(CREATE_STUDY), variables: createStudyInput }
        ).then(res => {
            const createdStudyId = res.body.data.createStudy.id;
            expect(createdStudyId).to.be.a('string');

            /* setup: upload files via API */
            const form = new FormData();
            form.append('operations', JSON.stringify({
                operationName: 'uploadFile',
                variables: {
                    studyId: createdStudyId,
                    description: 'TESTFILE_NO_ERROR',
                    file: null
                },
                query: print(UPLOAD_FILE)
            }));
            form.append('map', JSON.stringify({ 1: ['variables.file'] }));
            form.append('1', new File([this.file], 'CSVCurator.tsv'));
            return cy.form_request('http://localhost:3003/graphql', form);
        }).then(xhr => {
            const res = xhr.response;
            const createdFileId = res.body.data.uploadFile.id;
            const createdStudyId = res.body.data.uploadFile.studyId;
            expect(createdFileId).to.be.a('string');

            /* select the file as data file for loading */
            cy.visit(`/datasets/${createdStudyId}/data_management`);
            cy.contains('There is no data uploaded for this study yet.');
            cy.get('label:contains(Data file:) + select').select('CSVCurator.tsv').should('have.value', createdFileId);

            /* alert user if wrong version number format is entered */
            cy.get('div.error_banner:contains(Version number cannot be empty.)').should('not.exist');
            cy.contains('Cancel').should('not.exist');
            cy.contains('Submit').click();
            cy.get('div.error_banner:contains(Version number cannot be empty.)');
            cy.get('label:contains(Version number:) + input').type('41a');
            cy.get('div.error_banner:contains(Version number cannot be empty.)').should('not.exist');
            cy.contains('Submit').click();
            cy.get('div.error_banner:contains(Invalid version number.)');
            cy.get('label:contains(Version number:) + input').clear().type('1.0');
            cy.get('div.error_banner:contains(Invalid version number.)').should('not.exist');
            cy.get('label:contains(Tag:) + input').type('Correct data');

            /* submit form */
            cy.contains('Submit').click();
            cy.get('div.saved_banner:contains(Job created and queued.)');

            /* jobs panels should be updated */
            cy.contains('DASHBOARD').click();
            cy.url().then(url => {
                expect(url).to.equal(`${Cypress.config().baseUrl}/datasets/${createdStudyId}/dashboard`);
                cy.contains('{"dataVersion": "1.0","versionTag": "Correct data"}');
                cy.contains('Finished', { timeout: 100000 });
            });
        });
    });

    it.only('Admin loads data; the app displays any error in data format', function () {
        cy.fixture('CSVCurator_error5.tsv').as('file');

        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        /* setup: create a study via API */
        const createStudyInput = { name: uuid() };
        cy.request('POST', 'http://localhost:3003/graphql',
            { query: print(CREATE_STUDY), variables: createStudyInput }
        ).then(res => {
            const createdStudyId = res.body.data.createStudy.id;
            expect(createdStudyId).to.be.a('string');

            /* setup: upload files via API */
            const form = new FormData();
            form.append('operations', JSON.stringify({
                operationName: 'uploadFile',
                variables: {
                    studyId: createdStudyId,
                    description: 'TESTFILE_NO_ERROR',
                    file: null
                },
                query: print(UPLOAD_FILE)
            }));
            form.append('map', JSON.stringify({ 1: ['variables.file'] }));
            form.append('1', new File([this.file], 'CSVCurator_error5.tsv'));
            return cy.form_request('http://localhost:3003/graphql', form);
        }).then(xhr => {
            const res = xhr.response;
            const createdFileId = res.body.data.uploadFile.id;
            const createdStudyId = res.body.data.uploadFile.studyId;
            expect(createdFileId).to.be.a('string');

            /* select the file as data file for loading */
            cy.visit(`/datasets/${createdStudyId}/data_management`);
            cy.contains('There is no data uploaded for this study yet.');
            cy.get('label:contains(Data file:) + select').select('CSVCurator_error5.tsv').should('have.value', createdFileId);
            cy.get('label:contains(Version number:) + input').type('1.0');
            cy.get('label:contains(Tag:) + input').type('Malformed data');
            cy.contains('Submit').click();
            cy.get('div.saved_banner:contains(Job created and queued.)');

            /* jobs panels should be updated */
            // cy.contains('DASHBOARD').click();
            cy.wait(20000);
            cy.visit(`/datasets/${createdStudyId}/dashboard`);
            cy.url().then(url => {
                expect(url).to.equal(`${Cypress.config().baseUrl}/datasets/${createdStudyId}/dashboard`);
                cy.get('table').contains('"dataVersion": "1.0"');
                cy.get('table').contains('"versionTag": "Malformed data"');
                cy.contains('Errored', { timeout: 100000 });

                /* see the errors */
                cy.get('span:contains(Errored) + svg').trigger('mouseenter');
                cy.contains('Line 1: \'1@2.1:8\' is not a valid header field descriptor.').should('be.visible');
            });
        });
    });
});
