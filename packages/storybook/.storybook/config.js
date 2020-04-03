import { addParameters, configure } from '@storybook/react';
import { themes } from '@storybook/theming';

addParameters({
    options: {
        theme: themes.dark,
        quiet: true
    },
});

const comps = require.context('@itmat/components/src', true, /.stories.tsx$/);

configure(() => {
    comps.keys().forEach(filename => comps(filename));
}, module);
