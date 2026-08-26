import { defineBuildConfig } from 'unbuild'


const rawConfig = {
  entries: ['src/cli', 'src/wrapper'],
  clean: true,
  declaration: true,
  rollup: {
    emitCJS: false,
  },
}
const finalConfig = defineBuildConfig(rawConfig)
export default finalConfig
/*
export default defineBuildConfig({
  entries: ['src/cli', 'src/wrapper'],
  clean: true,
  declaration: true,
  rollup: {
    emitCJS: false,
  },
})
*/
