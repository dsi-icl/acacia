/// <reference types="cypress" />
const { LOGIN_BODY_ADMIN } = require('../fixtures/loginstring');
const { CREATE_PROJECT, CREATE_STUDY, DELETE_PROJECT } = require('itmat-commons').GQLRequests;
const { print } = require('graphql');
const { v4: uuid } = require('uuid');

describe('Studies page', function () {
    it('admin can add dataset successfully', function () {
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        cy.visit('/datasets');

        /* initial states */
        cy.contains('Please pick the study you would like to access:').should('not.exist');

        /* create study */
        const createdStudyName = uuid();
        cy.contains('Submit').should('not.exist');
        cy.contains('Add new dataset').click();
        cy.contains('Enter name').children('input').type(createdStudyName);
        cy.contains('Submit').click();

        /* updated state */
        cy.contains(createdStudyName);
        cy.contains('Submit').should('not.exist');
    });

    it('admin can navigate to dataset details from main page successfully', function () {
        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        /* setup: create a study via API */
        const createdStudyName = uuid();
        cy.request('POST', 'http://localhost:3003/graphql',
            { query: print(CREATE_STUDY), variables: { name: createdStudyName } }
        ).then(res => {
            const createdStudyId = res.body.data.createStudy.id;
            expect(createdStudyId).to.be.a('string');


            cy.visit('/'); cy.get('a[title=Datasets] > div').click();

            cy.url().then(url => {
                expect(url).to.equal(`${Cypress.config().baseUrl}/datasets`);

                /* initial states */
                cy.contains('There is no dataset or you have not been added to any. Please contact admin.').should('not.exist');
                cy.contains('Please pick the study you would like to access:');
                cy.contains(createdStudyName).click();

                cy.url().then(url => {
                    expect(url).to.equal(`${Cypress.config().baseUrl}/datasets/${createdStudyId}/dashboard`);
                });
            });
        });
    });

    it('admin can create projects (e2e)', function () {
        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        /* setup: create a study via API */
        const createdStudyName = uuid();
        cy.request('POST', 'http://localhost:3003/graphql',
            { query: print(CREATE_STUDY), variables: { name: createdStudyName } }
        ).then(res => {
            const createdStudyId = res.body.data.createStudy.id;
            expect(createdStudyId).to.be.a('string');

            cy.visit(`/datasets/${createdStudyId}/`);
            cy.get('a > div:contains(PROJECTS)').click();

            const createdProjectName = uuid().substring(0, 10);
            cy.get('[placeholder="Enter name"]', { timeout: 100000 }).type(createdProjectName);
            cy.contains('Add new project').click();

            /* should have created new project and redirected */
            cy.contains(createdProjectName, { timeout: 100000 });
            cy.url().then(url => {
                expect(url).to.match(new RegExp(`${Cypress.config().baseUrl}/datasets/${createdStudyId}/projects/(\\w|-)+$`));
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
    });



    it('displays error message when creating new project if name is not provided (e2e)', function () {
        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        /* setup: create a study via API */
        const createdStudyName = uuid();
        cy.request('POST', 'http://localhost:3003/graphql',
            { query: print(CREATE_STUDY), variables: { name: createdStudyName } }
        ).then(res => {
            const createdStudyId = res.body.data.createStudy.id;
            expect(createdStudyId).to.be.a('string');

            cy.visit(`/datasets/${createdStudyId}/projects`);

            /* error bar should not be visible */
            cy.contains('Add new project', { timeout: 100000 });   // making sure ajax is finished
            cy.contains('Please enter project name.').should('not.exist');

            /* clicking the create new user button to go to page */
            cy.contains('Add new project').click();
            cy.contains('Please enter project name.').should('have.class', 'error_banner');
        });
    });

    it('admin can delete projects', function () {
        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        /* setup: create a study via API */
        const createdStudyName = uuid();
        cy.request('POST', 'http://localhost:3003/graphql',
            { query: print(CREATE_STUDY), variables: { name: createdStudyName } }
        ).then(res => {
            const createdStudyId = res.body.data.createStudy.id;
            expect(createdStudyId).to.be.a('string');

            /* setup: create the project to be deleted */
            const createdProjectName = uuid().substring(0, 10);
            cy.request('POST', 'http://localhost:3003/graphql',
                { query: print(CREATE_PROJECT), variables: { studyId: createdStudyId, projectName: createdProjectName } } // no 'approved fields' keys here as it's not available in the ui
            ).then(res => {
                const createdProjectId = res.body.data.createProject.id;
                expect(createdProjectId).to.be.a('string');

                cy.visit(`/datasets/${createdStudyId}/projects/${createdProjectId}`);

                /* delete the project */
                cy.get('h5:contains(Delete this project)');
                cy.contains('Click to delete').click();
                cy.contains(`Warning! This is irreversible! If you really want to delete this project, please type the name of the project (${createdProjectName}) below to confirm.`).as('warning');
                cy.get('@warning').siblings(`input[placeholder="${createdProjectName}"]`).type(createdProjectName);
                cy.get('@warning').siblings('button:contains(Really delete!)').click();
                cy.get('h5:contains(Projects)');
                cy.contains(createdProjectName).should('not.exist');
                cy.contains('Add new project');
                cy.url().then(url => {
                    expect(url).to.equal(`${Cypress.config().baseUrl}/datasets/${createdStudyId}/projects/`);
                });
            });
        });
    });
});
