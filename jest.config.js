module.exports = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: [
        '<rootDir>/src/test-utils/setupTests.ts'
    ],
    preset: 'ts-jest',
    snapshotSerializers: [
        'jest-serializer-path',
    ],
    clearMocks: true,
    transformIgnorePatterns: [],
    transform: {
        "\\.m?js?$": "jest-esm-transformer"
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
        "ace-builds": "<rootDir>/node_modules/ace-builds",
        "electron": "<rootDir>/__test__/__mocks__/electronMock.ts",
        "^dnd-core$": "dnd-core/dist/cjs",
        "^react-dnd$": "react-dnd/dist/cjs",
        "^react-dnd-html5-backend$": "react-dnd-html5-backend/dist/cjs",
        "^react-dnd-touch-backend$": "react-dnd-touch-backend/dist/cjs",
        "^react-dnd-test-backend$": "react-dnd-test-backend/dist/cjs",
        "^react-dnd-test-utils$": "react-dnd-test-utils/dist/cjs",
        "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$": '<rootDir>/__mocks__/fileMock.js',
        "\\.(css|less)$": 'identity-obj-proxy'
    }
};