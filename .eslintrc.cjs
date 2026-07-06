module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "plugin:react-hooks/recommended"],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  parser: "@typescript-eslint/parser",
  plugins: ["react-refresh"],
  rules: {
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
    ],
  },
  overrides: [
    {
      // TEMPORARY no-explicit-any allowance (~125 occurrences, down from 225 before
      // the consolidation refactor). Nearly all remaining `any`s are parameter
      // VALUES: node params flow as Record<string, any> from graphStore through
      // computeTyped, the properties panel, and scene serialization. Introducing a
      // real ParameterValue type and threading it through these files is one
      // coherent follow-up task; remove entries as files get typed, and do not add
      // new files here.
      files: [
        "src/engine/graphStore.ts",
        "src/engine/containers/BaseContainer.ts",
        "src/engine/parameterUtils.ts",
        "src/flow/nodes/**",
        "src/flow/FlowCanvas.tsx",
        "src/hooks/useFlowGraphSync.ts",
        "src/components/inputs/ParameterInput.tsx",
        "src/components/UnifiedPropertiesPanel.tsx",
        "src/rendering/SceneManager.ts",
        "src/rendering/materials/MaterialManager.ts",
        "src/io/mxscene/export.ts",
        "src/io/mxscene/import.ts",
        "src/io/mxscene/opfs-cache.ts",
        "src/io/mxscene/asset-discovery.ts",
      ],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],
};
