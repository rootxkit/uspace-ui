// `next/font/local` is a directory with an index, and `next` has no
// `exports` map, so NodeNext resolution (this repo's, PLAN D3) cannot find
// it, while Next's compiler, which consumers build with, matches the
// import by this exact specifier. This declaration gives the specifier the
// type of the function Next's own `font/local/index.d.ts` re-exports. That
// file is CommonJS to NodeNext, so its default export is the namespace's
// `default`. Not emitted: dist/fonts/index.d.ts names Next's types by file.
declare module "next/font/local" {
  import type local from "next/dist/compiled/@next/font/dist/local/index.js";
  const localFont: typeof local.default;
  export default localFont;
}
