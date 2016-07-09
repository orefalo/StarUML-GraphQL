define(function(require, exports, module) {
    "use strict";

    var AppInit = app.getModule("utils/AppInit"),
        Core = app.getModule("core/Core"),
        PreferenceManager = app.getModule("core/PreferenceManager");

    var preferenceId = "typescript";

    var typeScriptConfigure = {

        "typescript.gen": {
            text: "TypeScript Code Generation",
            type: "Section"
        },

        "typescript.gen.copyright": {
            text: "Copyright Text",
            description: "Copyright Text to use on all files",
            type: "String",
            default: "\n/*\n*(C) Copyright MyCompany, Inc. \n*All rights reserved\n*/\n"
        },

        "typescript.gen.indentSpaces": {
            text: "Indent Spaces",
            description: "Number of spaces for indentation.",
            type: "Number",
            default: 4
        },

        "typescript.gen.comments": {
            text: "Generate Comments",
            description: "Generate comments in JSDoc style.",
            type: "Check",
            default: false
        }

    };

    function getId() {
        return preferenceId;
    }

    function getGenOptions() {
        return {
            indentSpaces: PreferenceManager.get("typescript.gen.indentSpaces"),
            copyright: PreferenceManager.get("typescript.gen.copyright"),
            comments: PreferenceManager.get("typescript.gen.comments")
        };
    }

    AppInit.htmlReady(function() {
        PreferenceManager.register(preferenceId, "TypeScript", typeScriptConfigure);
    });

    exports.getId = getId;
    exports.getGenOptions = getGenOptions;

});
