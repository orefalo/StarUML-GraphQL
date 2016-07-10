/**
 *
 * Created by sdiemert on 15-07-10.
 */

define(function(require, exports, module) {
    "use strict";

    var Commands = app.getModule('command/Commands'),
        CommandManager = app.getModule("command/CommandManager"),
        MenuManager = app.getModule("menu/MenuManager"),
        FileSystem = app.getModule("filesystem/FileSystem"),
        ElementPickerDialog = app.getModule("dialogs/ElementPickerDialog"),
        Dialogs = app.getModule("dialogs/Dialogs"),

        TypeScriptCodeGenerator = require("TypeScriptCodeGenerator"),
        TypeScriptConfigure = require("TypeScriptConfigure");

    var OUTER_CMD = "tools.typescript",
        CMD_GENERATE = "tools.typescript.generate",
        CMD_ABOUT = "tools.typescript.about",
        CMD_CONFIG = "tools.typescript.configure";

    function generateTypeScript(base, path, options) {
        var result = new $.Deferred();
        console.log('base', base);
        console.log('path', path);
        console.log('options', options);
        // TODO generate ts code here
        return TypeScriptCodeGenerator.generate(base, path, options).then(result.resolve, result.reject);
        // return result.resolve();
    }

    function openFolder(base, path, options, result) {
        // If path is not assigned, popup Open Dialog to select a folder
        console.log('open folder', 'path', path);
        if (path === undefined) {
            FileSystem.showOpenDialog(false, true, "Select a folder where generated codes to be located", null, null, function(err, files) {
                if (!err) {
                    if (files.length > 0) {
                        path = files[0];
                        generateTypeScript(base, path, options).then(result.resolve, result.reject);
                    } else {
                        result.reject(FileSystem.USER_CANCELED);
                    }
                } else {
                    result.reject(err);
                }
            });
        } else {
            generateTypeScript(base, path, options).then(result.resolve, result.reject);
        }
    }
    /// openFolder

    function handleGenerate(base, path, options) {
        var result = new $.Deferred();
        options = TypeScriptConfigure.getGenOptions();
        console.log('base', base);
        console.log('path', path);
        console.log('options', options);
        // window.alert("generated type script");

        // If base is not assigned, popup ElementPicker
        if (base === undefined) {
            ElementPickerDialog.showDialog("Select a base model to generate codes", null, type.UMLPackage)
                .done(function(buttonId, selected) {
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
        CommandManager.execute(Commands.FILE_PREFERENCES, TypeScriptConfigure.getId());
    }

    function handleAbout() {
        window.alert("This is ...");
    }

    CommandManager.register("TypeScript", OUTER_CMD, CommandManager.doNothing);
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
