/**
 *
 * Created by sdiemert on 15-07-10.
 */

define(function (require, exports, module) {
  var Commands            = app.getModule('command/Commands');
  var CommandManager      = app.getModule("command/CommandManager");
  var MenuManager         = app.getModule("menu/MenuManager");
  var ElementPickerDialog = app.getModule("dialogs/ElementPickerDialog");
  var FileSystem          = app.getModule("filesystem/FileSystem");
  var Dialogs             = app.getModule("dialogs/Dialogs");

  var JSGen               = require("JSCodeGenerator");
  var JavaScriptConfigure = require("JavaScriptConfigure");

  var OUTER_CMD    = "typescript";
  var CMD_GENERATE = "typescript.generate";
  var CMD_CONFIG   = "typescript.configure";

  // CommandManager.register("TypeScript", OUTER_CMD, CommandManager.doNothing);
  // CommandManager.register("Generate...", CMD_GENERATE, handleGenerate);
  // CommandManager.register("Configure...", CMD_CONFIG, _handleConfigure);

  var menu, jsMenu;

  menu   = MenuManager.getMenu(Commands.TOOLS);
  jsMenu = menu.addMenuItem(OUTER_CMD);

  jsMenu.addMenuItem(CMD_GENERATE);
  jsMenu.addMenuDivider();
  jsMenu.addMenuItem(CMD_CONFIG);
});
