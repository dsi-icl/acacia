const chalk = require('chalk');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
const typescriptFormatter = require('react-dev-utils/typescriptFormatter');
const forkTsCheckerWebpackPlugin = require('react-dev-utils/ForkTsCheckerWebpackPlugin');

module.exports = (compiler, {
    useTypeScript,
    tscCompileOnError,
}) => {

    let tsMessagesPromise;
    let tsMessagesResolver;

    if (useTypeScript) {
        compiler.hooks.beforeCompile.tap('beforeCompileServer', () => {
            tsMessagesPromise = new Promise(resolve => {
                tsMessagesResolver = msgs => resolve(msgs);
            });
        });

        forkTsCheckerWebpackPlugin
            .getCompilerHooks(compiler)
            .receive.tap('afterTypeScriptCheckServer', (diagnostics, lints) => {
                const allMsgs = [...diagnostics, ...lints];
                const format = message =>
                    `${message.file}\n${typescriptFormatter(message, true)}`;

                tsMessagesResolver({
                    errors: allMsgs.filter(msg => msg.severity === 'error').map(format),
                    warnings: allMsgs
                        .filter(msg => msg.severity === 'warning')
                        .map(format),
                });
            });
    }

    compiler.hooks.done.intercept({
        context: true,
        register: (tapInfo) => {
            if (tapInfo.name === 'done') {
                tapInfo.fn = async stats => {
                    const statsData = stats.toJson({
                        all: false,
                        warnings: true,
                        errors: true,
                    });

                    if (useTypeScript && statsData.errors.length === 0) {
                        console.log(
                            chalk.yellow(
                                'Files successfully emitted, waiting for typecheck results...'
                            )
                        );

                        const messages = await tsMessagesPromise;
                        if (tscCompileOnError) {
                            statsData.warnings.push(...messages.errors);
                        } else {
                            statsData.errors.push(...messages.errors);
                        }
                        statsData.warnings.push(...messages.warnings);

                        // Push errors and warnings into compilation result
                        // to show them after page refresh triggered by user.
                        if (tscCompileOnError) {
                            stats.compilation.warnings.push(...messages.errors);
                        } else {
                            stats.compilation.errors.push(...messages.errors);
                        }
                        stats.compilation.warnings.push(...messages.warnings);
                    }

                    const messages = formatWebpackMessages(statsData);
                    const isSuccessful = !messages.errors.length && !messages.warnings.length;
                    if (isSuccessful) {
                        console.log(chalk.green('Compiled successfully!'));
                    }

                    // If errors exist, only show errors.
                    if (messages.errors.length) {
                        // Only keep the first error. Others are often indicative
                        // of the same problem, but confuse the reader with noise.
                        if (messages.errors.length > 1) {
                            messages.errors.length = 1;
                        }
                        console.log(chalk.red('Failed to compile.\n'));
                        console.log(messages.errors.join('\n\n'));
                        return;
                    }

                    // Show warnings if no errors were found.
                    if (messages.warnings.length) {
                        console.log(chalk.yellow('Compiled with warnings.\n'));
                        console.log(messages.warnings.join('\n\n'));

                        // Teach some ESLint tricks.
                        console.log(
                            '\nSearch for the ' +
                            chalk.underline(chalk.yellow('keywords')) +
                            ' to learn more about each warning.'
                        );
                        console.log(
                            'To ignore, add ' +
                            chalk.cyan('// eslint-disable-next-line') +
                            ' to the line before.\n'
                        );
                    }
                }
            }
            return tapInfo;
        }
    });
    return compiler;
}