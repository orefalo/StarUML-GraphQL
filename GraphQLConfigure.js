define(function(require, exports, module) {
    "use strict";

    var AppInit = app.getModule("utils/AppInit"),
        Core = app.getModule("core/Core"),
        PreferenceManager = app.getModule("core/PreferenceManager");

    var preferenceId = "graphql";

    var graphqlConfigure = {

        "graphql.gen.nodeserver": {
            text: "Node Server Code Generation-TODO",
            type: "Section"
        },

        "graphql.gen.gqDoc": {
            text: "GraphQL comments",
            description: "Generate GraphQL IDL comments.",
            type: "Check",
            default: true
        },

        "graphql.gen.copyright": {
            text: "Copyright Text",
            description: "Copyright Text to use on all files",
            type: "String",
            default: "\n/*\n*(C) Copyright MyCompany, Inc. \n*All rights reserved\n*/\n"
        },

        "graphql.gen.indentSpaces": {
            text: "Indent Spaces",
            description: "Number of spaces for indentation.",
            type: "Number",
            default: 4
        },


    };

    function getId() {
        return preferenceId;
    }

    function getGenOptions() {
        return {
            gqDoc: PreferenceManager.get("graphql.gen.gqDoc"),
            indentSpaces: PreferenceManager.get("graphql.gen.indentSpaces"),
            copyright: PreferenceManager.get("graphql.gen.copyright")
        };
    }

    AppInit.htmlReady(function() {
        PreferenceManager.register(preferenceId, "GraphQL", graphqlConfigure);
    });

    exports.getId = getId;
    exports.getGenOptions = getGenOptions;

});
