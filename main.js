define(function (require, exports, module) {
    "use strict";

    var Commands = app.getModule('command/Commands'),
        CommandManager = app.getModule("command/CommandManager"),
        MenuManager = app.getModule("menu/MenuManager"),
        FileSystem = app.getModule("filesystem/FileSystem"),
        ElementPickerDialog = app.getModule("dialogs/ElementPickerDialog"),
        Dialogs = app.getModule("dialogs/Dialogs"),
        Toast = app.getModule('ui/Toast'),
        GraphQLCodeGenerator = require("GraphQLCodeGenerator"),
        GraphQLConfigure = require("GraphQLConfigure");

    var OUTER_CMD = "tools.graphql",
        CMD_GENERATE = "tools.graphql.generate",
        CMD_ABOUT = "tools.graphql.about",
        CMD_CONFIG = "tools.graphql.configure";

    function generateGraphQL(base, path, options) {
        var result = new $.Deferred();
        console.log('base', base);
        console.log('path', path);
        console.log('options', options);

        GraphQLCodeGenerator.generate(base, path, options).then(
            function () {
                Toast.info("GraphQL generation completed");
                result.resolve;
            },
            function () {
                Toast.error("Generation Failed!");
                result.reject;
            });
        return result.promise();
    }

    function openFolder(base, path, options, result) {
        // If path is not assigned, popup Open Dialog to select a folder
        console.log('open folder', 'path', path);
        if (path === undefined) {
            FileSystem.showOpenDialog(false, true, "Select a folder where generated codes to be located", null, null, function (err, files) {
                if (!err) {
                    if (files.length > 0) {
                        path = files[0];
                        generateGraphQL(base, path, options).then(result.resolve, result.reject);
                    } else {
                        result.reject(FileSystem.USER_CANCELED);
                    }
                } else {
                    result.reject(err);
                }
            });
        } else {
            generateGraphQL(base, path, options).then(result.resolve, result.reject);
        }
    }

    /// openFolder

    function handleGenerate(base, path, options) {
        var result = new $.Deferred();
        options = GraphQLConfigure.getGenOptions();
        console.log('base', base);
        console.log('path', path);
        console.log('options', options);

        // If base is not assigned, popup ElementPicker
        if (base === undefined) {
            ElementPickerDialog.showDialog("Select the base model to generate from", null, type.UMLPackage)
                .done(function (buttonId, selected) {
                    console.log('ElementPickerDialog', buttonId, selected);
                    if (buttonId === Dialogs.DIALOG_BTN_OK && selected) {
                        base = selected;
                        openFolder(base, path, options, result);
                    } else {
                        result.reject();
                    }
                });
        } else {
            openFolder(base, path, options);
        }
    }

    /// handleGenerate
    function handleConfigure() {
        CommandManager.execute(Commands.FILE_PREFERENCES, GraphQLConfigure.getId());
    }

    function handleAbout() {
        Dialogs.showInfoDialog("My name is Olivier Refalo, author behind this StarUML extension." +
            "I am an Innovator, a Digital transformer, a skilled  Architect, a Leader and an Entrepreneur. " +
            "Over the years I grew extensive knowledge around data modeling, reactive technologies, business processes," +
            " integrations and enterprise architecture. " +
            "Lately I grew my technical skills around GraphQL which I see as an elegant way to solve the middleware mess" +
            " with an inversion of control approach. " +
            "I believe in open source as a way to drive innovations and share knowledge, this project is yet another way" +
            " to contribute back to the community." +
            "With that said, if you do use this extension, please consider a donation. " +
            "Project and documentation available at http://github.com/orefalo/StarUML-GraphQL.");
    }

    CommandManager.register("GraphQL", OUTER_CMD, CommandManager.doNothing);
    CommandManager.register("Generate...", CMD_GENERATE, handleGenerate);
    CommandManager.register("Configure...", CMD_CONFIG, handleConfigure);
    CommandManager.register("About", CMD_ABOUT, handleAbout);

    var menu = MenuManager.getMenu(Commands.TOOLS);
    var tsMenu = menu.addMenuItem(OUTER_CMD);
    tsMenu.addMenuItem(CMD_GENERATE);
    tsMenu.addMenuItem(CMD_CONFIG);
    tsMenu.addMenuDivider();
    tsMenu.addMenuItem(CMD_ABOUT);
});
