const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ["dist/**", ".expo/**"],
    rules: {
      // Native sheets intentionally reset editable draft state when their record/visibility changes.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
