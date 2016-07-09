/**
 *
 * Created by sdiemert on 15-07-10.
 */

define(function(require, exports, module) {
    "use strict";

    var Commands = app.getModule('command/Commands'),
        CommandManager = app.getModule("command/CommandManager"),
        MenuManager = app.getModule("menu/MenuManager");
    // var ElementPickerDialog = app.getModule("dialogs/ElementPickerDialog");
    // var FileSystem = app.getModule("filesystem/FileSystem");
    // var Dialogs = app.getModule("dialogs/Dialogs");

    // var JSGen = require("JSCodeGenerator");
    var TypeScriptConfigure = require("TypeScriptConfigure");

    var OUTER_CMD = "tools.typescript";
    var CMD_GENERATE = "tools.typescript.generate";
    var CMD_ABOUT = "tools.typescript.about";
    var CMD_CONFIG = "tools.typescript.configure";

    function handleGenerate(base, path, opts) {
        // var result = new $.Deferred();
        opts = TypeScriptConfigure.getGenOptions();
        console.log(opts);
        window.alert("generated type script");
    }

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
