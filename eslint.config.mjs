import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import stylistic from "@stylistic/eslint-plugin";

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    stylistic.configs.customize({
        indent: 4,
        quotes: "double",
        semi: true,
        arrowParens: true,
        braceStyle: "1tbs",
        commaDangle: "always-multiline",
        quoteProps: "as-needed",
        jsx: true,
    }),
    {
        rules: {
            "@stylistic/jsx-closing-bracket-location": [
                "error",
                { nonEmpty: "after-props", selfClosing: "tag-aligned" },
            ],
            "@stylistic/jsx-one-expression-per-line": "off",
            "@stylistic/jsx-quotes": ["error", "prefer-double"],
            "@stylistic/operator-linebreak": ["error", "after"],
            "@stylistic/linebreak-style": ["error", "unix"],
            "padding-line-between-statements": ["error",
                { blankLine: "always", prev: "block-like", next: "*" },
            ],
        },
    },
    {
        // PocketBase runs these files in its embedded JavaScript runtime.
        files: ["pocketbase/**/*.{js,cjs}"],
        languageOptions: {
            sourceType: "commonjs",
            globals: {
                __hooks: "readonly",
                $apis: "readonly",
                $app: "readonly",
                $dbx: "readonly",
                $http: "readonly",
                $os: "readonly",
                $security: "readonly",
                ApiError: "readonly",
                BadRequestError: "readonly",
                Collection: "readonly",
                DynamicModel: "readonly",
                ForbiddenError: "readonly",
                JSONField: "readonly",
                NotFoundError: "readonly",
                NumberField: "readonly",
                Record: "readonly",
                SelectField: "readonly",
                TextField: "readonly",
                UnauthorizedError: "readonly",
                arrayOf: "readonly",
                cronAdd: "readonly",
                migrate: "readonly",
                onRecordCreateRequest: "readonly",
                onRecordDelete: "readonly",
                onRecordUpdateRequest: "readonly",
                onRecordValidate: "readonly",
                routerAdd: "readonly",
            },
        },
        rules: {
            // PocketBase uses require() and generated global type declarations.
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/triple-slash-reference": ["error", { path: "always" }],
            "no-undef": "error",
        },
    },
    globalIgnores([
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
        "coverage/**",
        "artifacts/**",
        ".vercel/**",
        "pocketbase/pb_data/**",
        "pocketbase/pb_public/**",
    ]),
]);

export default eslintConfig;
