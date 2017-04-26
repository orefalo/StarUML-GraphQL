/*global define, $, _, window, app, type, document, meta */

define(function (require, exports, module) {
    "use strict";

    var ExtensionUtils = app.getModule("utils/ExtensionUtils"),
        PanelManager = app.getModule("utils/PanelManager"),
        Engine = app.getModule("engine/Engine"),
        Repository = app.getModule("core/Repository"),
        SelectionManager = app.getModule("engine/SelectionManager"),
        Commands = app.getModule('command/Commands'),
        CommandManager = app.getModule("command/CommandManager"),
        MenuManager = app.getModule("menu/MenuManager"),

        ContextMenuManager = app.getModule("menu/ContextMenuManager"),
        DefaultMenus = app.getModule("menu/DefaultMenus"),
        ModelExplorerView = app.getModule("explorer/ModelExplorerView"),

        FileSystem = app.getModule("filesystem/FileSystem"),
        ElementPickerDialog = app.getModule("dialogs/ElementPickerDialog"),
        Dialogs = app.getModule("dialogs/Dialogs"),
        Toast = app.getModule('ui/Toast'),

        GraphQLCodeGenerator = require("GraphQLCodeGenerator"),
        GraphQLConfigure = require("GraphQLConfigure"),
        PreferenceManager = app.getModule("core/PreferenceManager");

    // Selected element for preview purposes
    var _currentElement;

    var OUTER_CMD = "tools.graphql",
        CMD_ADDFAKE_DIRECTIVE = "tools.graphql.addfake",
        CMD_REMOVEFAKE_DIRECTIVE = "tools.graphql.removefake",
        CMD_REMOVEALL_DIRECTIVE = "tools.graphql.removeall",
        CMD_GENERATE = "tools.graphql.generate",
        CMD_GENERATE_TOFILE = "tools.graphql.generatetofile",
        CMD_ABOUT = "tools.graphql.about",
        CMD_CONFIG = "tools.graphql.configure",
        CMD_TOGGLE_PREVIEW = "tools.graphql.preview",
        PREFERENCE_KEY = "tools.graphql.visibility";

    function generateGraphQL(base, path, options) {
        var result = new $.Deferred();

        if (options.debug) {
            console.log('base', base);
            console.log('path', path);
            console.log('options', options);
        }

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
        if (options.debug)
            console.log('open folder', 'path', path);
        if (path === undefined) {

            FileSystem.showSaveDialog("Save GraphQL File as...", null, "schema_" + base.name + ".gql", function (err, file) {
                if (!err) {
                    if (file) {
                        path = file;
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

        // If base is not assigned, popup ElementPicker
        if (base === undefined) {
            ElementPickerDialog.showDialog("Select the element to generate from", null, type.Element)
                .done(function (buttonId, selected) {
                    if (options.debug)
                        console.log('ElementPickerDialog', buttonId, selected);
                    if (buttonId === Dialogs.DIALOG_BTN_OK && selected) {

                        if (selected instanceof type.Project || selected instanceof type.UMLPackage) {
                            base = selected;
                            openFolder(base, path, options, result);
                        } else {
                            Dialogs.showErrorDialog("Please select the Project or a package");
                            result.reject();
                        }
                    } else {
                        result.reject();
                    }
                });
        } else {
            openFolder(base, path, options, result);
        }
        return result.promise();
    }

    function handleGenerateToFile() {
        handleGenerate(_currentElement)
    }


    function printTagOrConstraint(elem) {

        var i, len, e;

        var oe = elem.ownedElements;
        for (i = 0, len = oe.length; i < len; i++) {
            e = oe[i];

            if (e instanceof type.UMLConstraint) {
                console.log("@" + e.name + "(" + e.specification + ")");
            }
        }

        var tags = elem.tags;
        for (i = 0, len = tags.length; i < len; i++) {
            e = tags[i];

            if (e instanceof type.Tag) {
                console.log("@" + e.name + "(" + e.value + ")");
            }
        }
    }


    function handleGenerateFaker(base, path, options) {
        var result = new $.Deferred();

        var selected = SelectionManager.getSelectedModels();
        selected.forEach(function (e) {
            if (e instanceof type.UMLAttribute) {
                printTagOrConstraint(e);
            }
            else if (e instanceof type.UMLClassifier) {
                e.attributes.forEach(function (attr) {
                    printTagOrConstraint(attr);
                });
            }
            result.resolve();
        });
        return result.promise();
    }

    /// handleGenerate
    function handleConfigure() {
        CommandManager.execute(Commands.FILE_PREFERENCES, GraphQLConfigure.getId());
    }

    function handleAbout() {
        Dialogs.showInfoDialog("My name is Olivier Refalo, author behind this StarUML extension." +
            "I am an Innovator, a Digital transformer, a skilled  Architect, a Leader and an Entrepreneur. " +
            "Over the years I grew extensive knowledge around data modeling, reactive technologies, " +
            "business processes, integrations and enterprise architecture. Lately I grew my technical " +
            "skills around GraphQL which I see as an elegant way to solve the middleware mess" +
            " with an inversion of control approach. I believe in open source as a way to drive innovations " +
            "and share knowledge, this project is yet another way to contribute back to the community." +
            "With that said, if you do use this extension, please consider a donation. " +
            "Project and documentation available at http://github.com/orefalo/StarUML-GraphQL.");
    }

    // Setup preview panel
    ExtensionUtils.loadStyleSheet(module, "styles.less");

    var graphqlPreviewPanel = $(require("text!graphql-panel.html"));
    graphqlPreviewPanel.find(".close").click(function () {
        // close button
        hidePreview();
    });
    graphqlPreviewPanel.find("graphql-editor").click(function () {
        // close button
        hidePreview();
    });

    var toolbar = graphqlPreviewPanel.find(".toolbar");
    var panel = graphqlPreviewPanel.find(".panel-content");

    var graphqlPanel = PanelManager.createBottomPanel("?", graphqlPreviewPanel, 29);

    // Setup vertical toolbar button
    var designerButton = $("<a id='toolbar-graphql' href='#' title='GraphQL Preview'></a>");
    $("#toolbar .buttons").append(designerButton);
    designerButton.click(function () {
        CommandManager.execute(CMD_TOGGLE_PREVIEW);
    });

    // Setup commands
    CommandManager.register("GraphQL", OUTER_CMD, CommandManager.doNothing);
    CommandManager.register("Toggle Preview", CMD_TOGGLE_PREVIEW, handleTogglePreview);
    CommandManager.register("Generate...", CMD_GENERATE, handleGenerate);
    CommandManager.register("Configure...", CMD_CONFIG, handleConfigure);
    CommandManager.register("About", CMD_ABOUT, handleAbout);

    //CommandManager.register("Add @faker", CMD_ADDFAKE_DIRECTIVE, handleGenerateFaker);
    //CommandManager.register("Remove all @faker", CMD_REMOVEFAKE_DIRECTIVE, handleGenerateFaker);
    //CommandManager.register("Remove all @directives", CMD_REMOVEALL_DIRECTIVE, handleGenerateFaker);
    CommandManager.register("Generate to File...", CMD_GENERATE_TOFILE, handleGenerateToFile);

    // Setup top-menu
    var menu = MenuManager.getMenu(Commands.TOOLS);
    var tsMenu = menu.addMenuItem(OUTER_CMD);

    tsMenu.addMenuItem(CMD_TOGGLE_PREVIEW);
    tsMenu.addMenuItem(CMD_GENERATE);
    tsMenu.addMenuDivider();
    tsMenu.addMenuItem(CMD_CONFIG);
    tsMenu.addMenuDivider();
    tsMenu.addMenuItem(CMD_ABOUT);

    // Setup context-menu
    var contextMenu = ContextMenuManager.getContextMenu(DefaultMenus.contextMenus.DIAGRAM);
    contextMenu.addMenuDivider();
    tsMenu = contextMenu.addMenuItem(OUTER_CMD);
    //tsMenu.addMenuItem(CMD_ADDFAKE_DIRECTIVE);
    //tsMenu.addMenuItem(CMD_REMOVEFAKE_DIRECTIVE);
    //tsMenu.addMenuItem(CMD_REMOVEALL_DIRECTIVE);
    //tsMenu.addMenuDivider();
    tsMenu.addMenuItem(CMD_GENERATE_TOFILE);

    contextMenu = ContextMenuManager.getContextMenu(DefaultMenus.contextMenus.EXPLORER);
    contextMenu.addMenuDivider();
    tsMenu = contextMenu.addMenuItem(OUTER_CMD);
    //tsMenu.addMenuItem(CMD_ADDFAKE_DIRECTIVE);
    //tsMenu.addMenuItem(CMD_REMOVEFAKE_DIRECTIVE);
    //tsMenu.addMenuItem(CMD_REMOVEALL_DIRECTIVE);
    //tsMenu.addMenuDivider();
    tsMenu.addMenuItem(CMD_GENERATE_TOFILE);

    // handles show/hide actions
    function showPreview() {
        graphqlPanel.show();
        designerButton.addClass("selected");
        CommandManager.get(CMD_TOGGLE_PREVIEW).setChecked(true);
        PreferenceManager.set(PREFERENCE_KEY, true);
    }

    function hidePreview() {
        graphqlPanel.hide();
        designerButton.removeClass("selected");
        CommandManager.get(CMD_TOGGLE_PREVIEW).setChecked(false);
        PreferenceManager.set(PREFERENCE_KEY, false);
    }

    function handleTogglePreview() {
        if (graphqlPanel.isVisible()) {
            hidePreview();
        } else {
            showPreview();
        }
    }

    // Set UI from saved Preference
    var visible = PreferenceManager.get(PREFERENCE_KEY);
    if (visible === true) {
        showPreview();
    } else {
        hidePreview();
    }

    function setCurrentElement(elem) {
        _currentElement = elem;
        var options = GraphQLConfigure.getGenOptions();
        var gql_code = GraphQLCodeGenerator.generateString(elem, options);

        document.getElementById("graphqleditable").innerHTML = gql_code;
    }

    // Handler for selectionChanged event
    $(SelectionManager).on("selectionChanged", function (event, models, views) {
        setCurrentElement(models.length > 0 ? models[0] : null);
    });

    // Handlers for element updated event
    $(Repository).on('updated', function (event, elems) {
        if (elems.length === 1 && elems[0] === _currentElement) {
            setCurrentElement(elems[0]);
        }
    });

});
