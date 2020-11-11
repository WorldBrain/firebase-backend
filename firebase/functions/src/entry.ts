import path from 'path';
import ModuleAlias from 'module-alias';
import tsconfig from '../tsconfig.json';
const { compilerOptions: { baseUrl } } = tsconfig;
const aliases = Object.entries(tsconfig.compilerOptions.paths).reduce(
    (acc, [key, [alias]]) => ({
        ...acc,
        [key.replace('/*', '')]: path.join(path.resolve(__dirname, '..'), baseUrl, alias).replace('/*', '/'),
    }),
    {}
); ModuleAlias.addAliases(aliases);

export * from './main'
