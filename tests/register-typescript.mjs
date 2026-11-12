import { registerHooks } from 'node:module'

// Vite accepts extensionless TypeScript imports; resolve them for Node's test runner too.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/^\.{1,2}\//.test(specifier)) throw error
      return nextResolve(`${specifier}.ts`, context)
    }
  },
})
