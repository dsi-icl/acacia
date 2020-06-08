/// <reference types="cypress" />
const { LOGIN_BODY_ADMIN } = require('../fixtures/loginstring');
const { CREATE_STUDY } = require('itmat-commons').GQLRequests;
const { print } = require('graphql');
const { v4: uuid } = require('uuid');

describe('File upload page', function () {
    it.only('admin can add upload files and then download successfully', function () { /* setup: login via API */
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
            cy.fixture('test.txt').then(fileContent => {
                cy.get('input[type=file]').upload({ fileContent, fileName: 'text.txt', mimeType: 'text/plain' });
                cy.contains('Description').children('input').type('Just a test file.');
                cy.get('button:contains("Upload")').click();
                cy.contains('Uploaded.');

                /* check whether file appears on the file list */
                cy.contains('Existing files').next().as('fileTable');
                cy.get('@fileTable').contains('td', 'text.txt');
                cy.get('@fileTable').contains('td', 'Just a test file.');
                cy.get('@fileTable').contains('button', 'Download').as('downloadButton');

                /* download the file and check whether it's the same file that was uploaded */
                cy.get('@downloadButton').parent('a').should('have.attr', 'href').then(href => {
                    fetch(href).then(res => res.blob()).then(blob => {
                        expect(blob.size).to.not.equal(0);
                        return blob.text();
                    }).then(text => {
                        expect(text).to.equal(fileContent);

                        /* cleanup: delete file via API */
                    });
                });
            });

        });
    });

    it('admin can delete files successfully', function () { /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        /* setup: create a study via API */
        const createStudyInput = { name: uuid() };
        cy.request('POST', 'http://localhost:3003/graphql',
            { query: print(CREATE_STUDY), variables: createStudyInput }
        ).then(res => {
            const createdStudyId = res.body.data.createStudy.id;
            expect(createdStudyId).to.be.a('string');

            /* setup: upload new file via API */




            cy.visit(`/datasets/${createdStudyId}/files`);

            /* delete file */

        });
    });
});
