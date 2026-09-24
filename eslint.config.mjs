import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = [
  // Build output and vendored code are never ours to lint.
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"],
  },

  // eslint-config-next ships real flat configs from v16 on; routing them
  // through FlatCompat's eslintrc loader crashes on its plugin graph.
  ...nextCoreWebVitals,
  ...nextTypeScript,

  // Config files at the root are plain CommonJS/ESM node scripts, not app
  // code: tailwind.config.js legitimately require()s its plugins.
  {
    files: ["*.js", "*.cjs", "*.mjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // An unused argument or a deliberately discarded binding is written with a
  // leading underscore; that is a statement of intent, not an oversight.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // Must stay last: turns off every rule that would fight Prettier.
  prettier,
];

export default eslintConfig;
