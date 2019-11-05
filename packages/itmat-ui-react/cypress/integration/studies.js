/// <reference types="cypress" />
const { LOGIN_BODY_ADMIN } = require('../fixtures/loginstring');
const { CREATE_PROJECT, CREATE_STUDY, DELETE_PROJECT } = require('itmat-commons').GQLRequests;
const { print } = require('graphql');

describe('Studies page', function() {
    it('admin can add dataset successfully', function() {
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        cy.visit('/datasets');

        /* initial states */
        cy.contains('There is no dataset or you have not been added to any. Please contact admin.');
        cy.contains('Please pick the study you would like to access:').should('not.exist');

        /* create study */
        cy.contains('Submit').should('not.exist');
        cy.contains('Add new dataset').click();
        cy.contains('Enter name').children('input').type('testingDataset');
        cy.contains('Submit');

        /* updated state */
        cy.contains('Submit').should('not.exist');
        cy.contains('testingDataset');
    });

    it('admin can navigate to dataset details from main page successfully', function() {
        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        /* setup: create a study via API */
        const createStudyInput = { name: 'testingStudy2' };
        cy.request('POST', 'http://localhost:3003/graphql',
            { query: print(CREATE_STUDY), variables: createStudyInput }
        ).then(res => {
            const createdStudyId = res.body.data.createStudy.id;
            expect(createdStudyId).to.be.a('string');


            cy.visit('/'); cy.get('a[title=Datasets]').click();

            cy.url().then(url => {
                expect(url).to.equal('http://localhost:3003/datasets');

                /* initial states */
                cy.contains('There is no dataset or you have not been added to any. Please contact admin.').should('not.exist');
                cy.contains('Please pick the study you would like to access:');
                cy.contains('testingStudy2').click();

                cy.url().then(url => {
                    expect(url).to.equal(`http://localhost:3003/datasets/${createdStudyId}`);
                });
            });
        });
    });

    it.only('admin can create projects (e2e)', function() {
        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);
        const studyId = '5f0e6362-e593-4d61-a2bc-73730d8933f6';
        cy.visit(`/datasets/${studyId}/projects`);

        /* clicking the create new user button to go to page */
        cy.get('[placeholder="Enter name"]', { timeout: 100000 }).type('newprojecttest');
        cy.contains('Add new project').click();

        /* should have created new project and redirected */
        cy.url().then(url => {
            expect(url).to.match(new RegExp(`${Cypress.config().baseUrl}/datasets/${studyId}/projects/(\\w|-)+$`));
            cy.contains('newprojecttest');
            const listOfHeadingsTobeExpected = [
                'Role',
                'Patient ID Mapping',
                'Delete this project',
                'Granted Fields',
                'Granted Files'
            ];
            listOfHeadingsTobeExpected.forEach(el => {
                cy.get(`h5:contains(${el})`);
            });

            /* cleanup: delete the project */
            const projectId = url.substring(url.lastIndexOf('/') + 1);
            cy.request('POST', 'http://localhost:3003/graphql', { query: print(DELETE_PROJECT), variables: { projectId } })
                .its('body.data.deleteProject.successful').should('eq', true);
        });

    });



    it('displays error message when creating new project if name is not provided (e2e)', function() {
        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);
        const studyId = '5f0e6362-e593-4d61-a2bc-73730d8933f6';
        cy.visit(`/datasets/${studyId}/projects`);

        /* error bar should not be visible */
        cy.contains('Add new project', { timeout: 100000 });   // making sure ajax is finished 
        cy.contains('Please enter project name.').should('not.exist');

        /* clicking the create new user button to go to page */
        cy.contains('Add new project').click();
        cy.contains('Please enter project name.').should('have.class', 'error_banner');
    });

    // it('admin can delete projects', function () {
    //     /* setup: login via API */
    //     cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);
    //     const studyId = '5f0e6362-e593-4d61-a2bc-73730d8933f6';

    //     /* setup: create the project to be deleted */
    //     cy.request('POST', 'http://localhost:3003/graphql', { query: print(CREATE_PROJECT), variables: { studyId, projectName: 'testProject' } }) // no 'approved fields' keys here as it's not available in the ui
    //         .then(res => {
    //             const createdProjectId = res.body.data.createProject.id;
    //             expect(createdProjectId).to.be.a('string');

    //             cy.visit(`/datasets/${studyId}/projects/${createdProjectId}`);


    //         });


    // });

    it('', function() {
        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);
        const studyId = '5f0e6362-e593-4d61-a2bc-73730d8933f6';
        cy.visit(`/datasets/${studyId}/projects`);

        /* error bar should not be visible */
        cy.contains('Add new project', { timeout: 100000 });   // making sure ajax is finished 
        cy.contains('Please enter project name.').should('not.exist');

        /* clicking the create new user button to go to page */
        cy.contains('Add new project').click();
        cy.contains('Please enter project name.').should('have.class', 'error_banner');
    });

});