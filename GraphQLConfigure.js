
/*global define, $, _, window, app, type, document */

define(function(require, exports, module) {
    "use strict";

    var AppInit = app.getModule("utils/AppInit"),
        Core = app.getModule("core/Core"),
        PreferenceManager = app.getModule("core/PreferenceManager");

    var preferenceId = "graphql";

    var graphqlConfigure = {

        "graphql.gen.nodeserver": {
            text: "GraphQL generator settings",
            type: "Section"
        },

        "graphql.gen.gqDoc": {
            text: "GraphQL comments",
            description: "Generate GraphQL IDL comments.",
            type: "Check",
            default: true
        },

        "graphql.gen.indentSpaces": {
            text: "Indent Spaces",
            description: "Number of spaces for indentation.",
            type: "Number",
            default: 4
        },

        "graphql.gen.debug": {
            text: "Debug on console",
            description: "Output debug information on Console",
            type: "Check",
            default: false
        },
    };

    function getId() {
        return preferenceId;
    }

    function getGenOptions() {
        return {
            gqDoc: PreferenceManager.get("graphql.gen.gqDoc"),
            indentSpaces: PreferenceManager.get("graphql.gen.indentSpaces"),
            debug: PreferenceManager.get("graphql.gen.debug")
        };
    }

    AppInit.htmlReady(function() {
        PreferenceManager.register(preferenceId, "GraphQL", graphqlConfigure);
    });

    exports.getId = getId;
    exports.getGenOptions = getGenOptions;

});
