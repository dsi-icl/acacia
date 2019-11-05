
/// <reference types="cypress" />
const { LOGIN_BODY_ADMIN } = require('../fixtures/loginstring');
const { CREATE_PROJECT, CREATE_STUDY, DELETE_PROJECT } = require('itmat-commons').GQLRequests;
const { print } = require('graphql');
const uuid = require('uuid/v4');

describe('File upload page', function() {
    it.only('admin can add upload files successfully', function() { /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        /* setup: create a study via API */
        const createStudyInput = { name: uuid() };
        cy.request('POST', 'http://localhost:3003/graphql',
            { query: print(CREATE_STUDY), variables: createStudyInput }
        ).then(res => {
            const createdStudyId = res.body.data.createStudy.id;
            expect(createdStudyId).to.be.a('string');

            cy.visit(`/datasets/${createdStudyId}/files`);

            /* upload files */
            cy.contains('Upload new file');
            cy.fixture('test.txt').as('textfile')
            cy.contains('Select file').children('input[type=file]').then(el => {
                /* programmatically add file to the input */
                /* zeburek commented on 20 Sep; https://github.com/cypress-io/cypress/issues/170 */
                Cypress.Blob.base64StringToBlob(this.textfile, 'text/plain').then(blob => {
                    const testFile = new File([blob], 'test.txt', { type: 'text/plain;charset=utf-8' });
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(testFile);
                    el[0].files = dataTransfer.files;
                    cy.wrap(el[0]).trigger('change', { force: true });
                    console.log(el);
                    cy.contains('Description').children('input').type('Just a test file.');
                    cy.get('button:contains("Upload")').click();
                    cy.contains('Uploaded.');
                    cy.contains('test.txt');
                    cy.contains('Download');
                });
            });

            /* cleanup: delete file via API */
        });
    });

    it('admin can delete files successfully', function() { /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        /* setup: create a study via API */
        const createStudyInput = { name: 'testingStudy4' };
        cy.request('POST', 'http://localhost:3003/graphql',
            { query: print(CREATE_STUDY), variables: createStudyInput }
        ).then(res => {
            const createdStudyId = res.body.data.createStudy.id;
            expect(createdStudyId).to.be.a('string');

            /* setup: upload new file via API */




            cy.visit(`/datasets/${createdStudyId}/files`);

            /* upload files */
            cy.contains('Upload new file');
            cy.contains('Select file').children('input');

        });
    });

    it('admin can download files successfully', function() { /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        /* setup: create a study via API */
        const createStudyInput = { name: 'testingStudy4' };
        cy.request('POST', 'http://localhost:3003/graphql',
            { query: print(CREATE_STUDY), variables: createStudyInput }
        ).then(res => {
            const createdStudyId = res.body.data.createStudy.id;
            expect(createdStudyId).to.be.a('string');

            /* setup: upload new file via API */




            cy.visit(`/datasets/${createdStudyId}/files`);

            /* upload files */
            cy.contains('Upload new file');
            cy.contains('Select file').children('input');

        });
    });
});