/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, regexp: true */
/*global define, $, _, window, app, type, document */

define(function (require, exports, module) {
    "use strict";

    var Repository = app.getModule("core/Repository"),
        ProjectManager = app.getModule("engine/ProjectManager"),
        Engine = app.getModule("engine/Engine"),
        FileSystem = app.getModule("filesystem/FileSystem"),
        FileUtils = app.getModule("file/FileUtils"),
        Async = app.getModule("utils/Async"),
        UML = app.getModule("uml/UML");

    var CodeGenUtils = require("CodeGenUtils");

    /**
     * GraphQL Code Generator
     * @constructor
     *
     * @param {type.UMLPackage} baseModel
     * @param {string} basePath generated files and directories to be placed
     */
    function GraphQLCodeGenerator(baseModel, basePath) {

        /** @member {type.Model} */
        this.baseModel = baseModel;

        /** @member {string} */
        this.basePath = basePath;

    }

    /**
     * Return Indent String based on options
     * @param {Object} options
     * @return {string}
     */
    GraphQLCodeGenerator.prototype.getIndentString = function (options) {
        if (options.useTab) {
            return "\t";
        } else {
            var i, len, indent = [];
            for (i = 0, len = options.indentSpaces; i < len; i++) {
                indent.push(" ");
            }
            return indent.join("");
        }
    };

    /**
     * Generate codes from a given element
     * @param {type.Model} elem
     * @param {string} path
     * @param {Object} options
     * @return {$.Promise}
     */
    GraphQLCodeGenerator.prototype.generate = function (elem, path, options) {
        var result = new $.Deferred();

        var codeWriter = new CodeGenUtils.CodeWriter(this.getIndentString(options));
        console.log('generate', 'elem', elem);

        // Doc
        var doc = "\n";
        var project = ProjectManager.getProject();

        if (project.name && project.name.length > 0) {
            doc += "\nname: " + project.name;
        }
        if (project.version && project.version.length > 0) {
            doc += "\nversion: " + project.version;
        }
        if (project.author && project.author.length > 0) {
            doc += "\nauthor " + project.author;
        }
        if (project.copyright && project.copyright.length > 0) {
            doc += "\ncopyright " + project.copyright;
        }

        this.writeDoc(codeWriter, doc, options);
        codeWriter.writeLine();

        this.recurGenerate(codeWriter, elem, options);

        var file = FileSystem.getFileForPath(path + "/schema.gql");
        FileUtils.writeText(file, codeWriter.getData(), true).then(result.resolve, result.reject);

        return result.promise();

    };


    GraphQLCodeGenerator.prototype.recurGenerate = function (codeWriter, elem, options) {

        var result = new $.Deferred(), self = this;

        // Package
        if (elem instanceof type.UMLPackage) {
            Async.doSequentially(
                elem.ownedElements,
                function (child) {
                    console.log('package generate');
                    return self.recurGenerate(codeWriter, child, options);
                },
                false
            ).then(result.resolve, result.reject);

        } else if (elem instanceof type.UMLClass) {
            // Class
            console.log('Class generate ' + elem.name);

            if (this.isUnion(elem))
                this.writeUnion(codeWriter, elem, options);
            else if (this.isInput(elem))
                this.writeClass(codeWriter, elem, options, "input " + elem.name);
            else if (this.isSchema(elem))
                this.writeClass(codeWriter, elem, options, "schema");
            else
                this.writeClass(codeWriter, elem, options);

            codeWriter.writeLine();
            result.resolve();

        } else if (elem instanceof type.UMLPrimitiveType) {
            // Scalar
            console.log('Scalar generate' + elem.name);
            this.writeScalar(codeWriter, elem, options);
            codeWriter.writeLine();
            result.resolve();

        } else if (elem instanceof type.UMLInterface) {
            // Interface
            console.log('Interface generate' + elem.name);
            this.writeInterface(codeWriter, elem, options);
            codeWriter.writeLine();
            result.resolve();

        } else if (elem instanceof type.UMLEnumeration) {
            // Enum
            console.log('Enumeration generate' + elem.name);
            this.writeEnum(codeWriter, elem, options);
            codeWriter.writeLine();
            result.resolve();

        } else {
            // Others (Nothing generated.)
            console.log('nothing generate ' + elem);
            result.resolve();
        }

        return result.promise();

    };

    /**
     * Write Enum
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    GraphQLCodeGenerator.prototype.writeEnum = function (codeWriter, elem, options) {

        var i, len;
        // Doc
        this.writeDoc(codeWriter, elem.documentation, options);

        codeWriter.writeLine("enum " + elem.name + " {");
        codeWriter.indent();

        // Literals
        for (i = 0, len = elem.literals.length; i < len; i++) {
            codeWriter.writeLine(elem.literals[i].name);
        }

        codeWriter.outdent();
        codeWriter.writeLine("}");
    };

    /**
     * Write Scalar
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    GraphQLCodeGenerator.prototype.writeScalar = function (codeWriter, elem, options) {

        // Doc
        this.writeDoc(codeWriter, elem.documentation, options);
        codeWriter.writeLine("scalar " + elem.name);
    };

    /**
     * Write Interface
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    GraphQLCodeGenerator.prototype.writeInterface = function (codeWriter, elem, options) {
        var i, len, terms = [];

        // Doc
        this.writeDoc(codeWriter, elem.documentation, options);

        // Interface
        terms.push("interface");
        terms.push(elem.name);

        // Extends
        var _extends = this.getSuperClasses(elem);
        if (_extends.length > 0) {
            terms.push("extends " + _.map(_extends, function (e) {
                    return e.name;
                }).join(", "));
        }
        codeWriter.writeLine(terms.join(" ") + " {");
        codeWriter.writeLine();
        codeWriter.indent();

        // Member Variables
        this.recurWriteInterfaceAttributes(codeWriter, elem, options);

        // Methods
        for (i = 0, len = elem.operations.length; i < len; i++) {
            this.writeMutator(codeWriter, elem.operations[i], options);
            codeWriter.writeLine();
        }

        codeWriter.outdent();
        codeWriter.writeLine("}");
    };


    /**
     * Write Class
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    GraphQLCodeGenerator.prototype.writeClass = function (codeWriter, elem, options, keyword) {
        var i, len, terms = [], self = this;

        // Doc
        this.writeDoc(codeWriter, elem.documentation, options);

        // Class
        if (keyword)
            terms.push(keyword);
        else {
            terms.push("type");
            terms.push(elem.name);
        }

        // Extends
        var _extends = this.getSuperClasses(elem);
        if (_extends.length > 0) {

            if (_extends.length > 1)
                this.writeDoc(codeWriter, "WARNING: you can only extend one class, ignoring others", options);

            // can graphQL support more than one parent?
            terms.push("extends " + _extends[0].name);
        }

        // Implements
        var _implements = this.getSuperInterfaces(elem);
        if (_implements.length > 0) {
            if (_extends.length > 0) {
                terms.push(", " + _.map(_implements, function (e) {
                        return e.name;
                    }).join(", "));
            } else {
                terms.push("implements " + _.map(_implements, function (e) {
                        return e.name;
                    }).join(", "));
            }
        }

        codeWriter.writeLine(terms.join(" ") + " {");
        codeWriter.writeLine();
        codeWriter.indent();

        // recursive class attributes
        this.recurWriteClassAttributes(codeWriter, elem, options);

        // recursive interface attributes
        for (i = 0, len = _implements.length; i < len; i++) {
            var e = _implements[i];
            this.recurWriteInterfaceAttributes(codeWriter, e, options);
        }

        // mutators
        for (i = 0, len = elem.operations.length; i < len; i++) {
            this.writeMutator(codeWriter, elem.operations[i], options);
            codeWriter.writeLine();
        }

        codeWriter.outdent();
        codeWriter.writeLine("}");
    };

    GraphQLCodeGenerator.prototype.recurWriteInterfaceAttributes = function (codeWriter, elem, options) {

        var i, len;

        // Member Variables
        // (from attributes)
        for (i = 0, len = elem.attributes.length; i < len; i++) {
            this.writeAttribute(codeWriter, elem.attributes[i], options);
        }

        // (from associations)
        var associations = Repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLAssociation);
        });
        for (i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i];
            if (asso.end2.reference === elem && asso.end1.navigable === true) {
                this.writeAttribute(codeWriter, asso.end1, options);
            }
            if (asso.end1.reference === elem && asso.end2.navigable === true) {
                this.writeAttribute(codeWriter, asso.end2, options);
            }
        }

        var _implements = this.getSuperInterfaces(elem);
        if (_implements.length > 0) {
            this.writeDoc(codeWriter, "WARNING: Interfaces must EXTEND other interfaces, ignoring InterfaceRealization.", options);
        }

        // from parent interfaces
        var _extends = this.getSuperClasses(elem);
        for (i = 0, len = _extends.length; i < len; i++) {
            var e = _extends[i];
            this.recurWriteClassAttributes(codeWriter, e, options);
        }

    };

    GraphQLCodeGenerator.prototype.recurWriteClassAttributes = function (codeWriter, elem, options) {
        var i, len;

        // attributes
        for (i = 0, len = elem.attributes.length; i < len; i++) {
            this.writeAttribute(codeWriter, elem.attributes[i], options);
        }

        // (from associations)
        var associations = Repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLAssociation);
        });

        console.log('association length: ' + associations.length);
        for (i = 0, len = associations.length; i < len; i++) {

            var asso = associations[i];
            if (asso.end2.reference === elem && asso.end1.navigable === true) {
                this.writeAttribute(codeWriter, asso.end1, options);
            }
            if (asso.end1.reference === elem && asso.end2.navigable === true) {
                this.writeAttribute(codeWriter, asso.end2, options);
            }
        }

        var _extends = this.getSuperClasses(elem);
        if (_extends.length > 0) {
            this.recurWriteClassAttributes(codeWriter, _extends[0], options);
        }
    };

    /**
     * Write Union
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    GraphQLCodeGenerator.prototype.writeUnion = function (codeWriter, elem, options) {
        var i, len, terms = [];

        // Validations
        var _extends = this.getSuperClasses(elem);
        if (_extends.length > 0)
            this.writeDoc(codeWriter, "WARNING: Inheritance on union types is not GraphQL compliant, ignoring", options);

        var _implements = this.getSuperInterfaces(elem);
        if (_implements.length > 0)
            this.writeDoc(codeWriter, "WARNING: Implementing interfaces of union types is not GraphQL compliant, ignoring", options);

        if (elem.operations.length > 0)
            this.writeDoc(codeWriter, "WARNING: Operations on union types is not GraphQL compliant, ignoring.", options);

        if (elem.attributes.length > 0)
            this.writeDoc(codeWriter, "WARNING: Attributes on union types is not GraphQL compliant, ignoring.", options);

        // Class
        terms.push("union");
        terms.push(elem.name);
        terms.push("=");

        // (from dependencies)
        var dependencies = Repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLDependency);
        });

        console.log('dependencies length: ' + dependencies.length);

        if (dependencies.length > 0) {
            // Doc
            this.writeDoc(codeWriter, elem.documentation, options);


            for (i = 0, len = dependencies.length; i < len; i++) {
                terms.push(dependencies[i].target.name);
                terms.push('|');
            }
            terms.pop();
            codeWriter.writeLine(terms.join(" "));
        }
    };


    /**
     * Write graphQL mutator
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     * @param {boolean} skipBody
     * @param {boolean} skipParams
     */
    GraphQLCodeGenerator.prototype.writeMutator = function (codeWriter, elem, options) {
        if (elem.name.length > 0) {
            var terms = [];
            var params = elem.getNonReturnParameters();
            var returnParam = elem.getReturnParameter();

            // doc
            var doc = elem.documentation.trim();
            _.each(params, function (param) {
                if (param.documentation.length > 0)
                    doc += "\nparam: " + param.name + " " + param.documentation;
            });
            if (returnParam && returnParam.documentation.length > 0) {
                doc += "\nreturn: " + returnParam.documentation;
            }
            this.writeDoc(codeWriter, doc, options);

            // name + parameters
            var paramTerms = [];

            var i, len;
            for (i = 0, len = params.length; i < len; i++) {
                var p = params[i];
                var s = p.name + ": " + this.getType(p);
                paramTerms.push(s);
            }

            terms.push(elem.name + "(" + paramTerms.join(", ") + ")");

            // return type
            if (returnParam) {
                terms.push(": ");
                terms.push(this.getType(returnParam));
            }

            // graphql visual directives - modeled as Tags
            var _tags = elem.tags;
            if (_tags) {
                for (i = 0, len = _tags.length; i < len; i++) {
                    var e = _tags[i];
                    terms.push(" @" + e.name + "(" + e.value + ")");
                }
            }

            // graphql non-visible directives - modeled as Constraints
            var _oe = elem.ownedElements;
            if (_oe) {
                for (i = 0, len = _oe.length; i < len; i++) {
                    var e = _oe[i];
                    if (e instanceof type.UMLConstraint)
                        terms.push(" @" + e.name + "(" + e.specification + ")");
                }
            }

            codeWriter.writeLine(terms.join(" "));
        }
    };

    /**
     * Return type expression
     * @param {type.Model} elem
     * @return {string}
     */
    GraphQLCodeGenerator.prototype.getType = function (elem) {
        var _type = "String";
        // type name
        if (elem instanceof type.UMLAssociationEnd) {
            if (elem.reference instanceof type.UMLModelElement && elem.reference.name.length > 0) {
                _type = elem.reference.name;
            }
        } else {
            if (elem.type instanceof type.UMLModelElement && elem.type.name.length > 0) {
                _type = elem.type.name;
            } else if (_.isString(elem.type) && elem.type.length > 0) {
                _type = elem.type;
            }
        }

        // multiplicity
        if (elem.multiplicity) {
            if (_.contains(["1"], elem.multiplicity.trim())) {
                _type = _type + "!";
            } else if (_.contains(["0..*"], elem.multiplicity.trim())) {
                _type = "[" + _type + "]";
            } else if (_.contains(["1..*", "*"], elem.multiplicity.trim())) {
                _type = "[" + _type + "]!";
            }
            else if (elem.multiplicity.match(/^\d+$/)) {
                // number
                _type = "[" + _type + "]";
            }
            // 0..1 don't change anything
        }

        return _type;
    };


    /**
     * Write type attribute
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */

    GraphQLCodeGenerator.prototype.writeAttribute = function (codeWriter, elem, options) {

        var i, len;

        // console.log('writeAttribute', 'elem', elem, elem._parent instanceof type.UMLInterface);
        console.log('writeAttribute', 'elem', elem);

        var name = elem.name;
        if (name.length === 0 && elem instanceof type.UMLAssociationEnd) {
            name = elem._parent.name;
            if (name.length === 0) {
                // if neither the edge nor the relation has a name, make up a name based on the classname
                name = "to" + elem.reference.name;
            }
        }

        if (name.length > 0) {
            var terms = [];
            // doc
            this.writeDoc(codeWriter, elem.documentation, options);

            // name
            terms.push(name);
            terms.push(": ");

            // type
            terms.push(this.getType(elem));

            // initial value
            if (elem.defaultValue && elem.defaultValue.length > 0) {
                terms.push("=" + elem.defaultValue);
            }

            // graphql visual directives - modeled as Tags
            var _tags = elem.tags;
            if (_tags) {
                for (i = 0, len = _tags.length; i < len; i++) {
                    var e = _tags[i];
                    terms.push(" @" + e.name + "(" + e.value + ")");
                }
            }

            // graphql non-visible directives - modeled as Constraints
            var _oe = elem.ownedElements;
            if (_oe) {
                for (i = 0, len = _oe.length; i < len; i++) {
                    var e = _oe[i];
                    if (e instanceof type.UMLConstraint)
                        terms.push(" @" + e.name + "(" + e.specification + ")");
                }
            }

            codeWriter.writeLine(terms.join(""));
        }
    };

    /**
     * Write documentation comments
     * @param {StringWriter} codeWriter
     * @param {string} text
     * @param {Object} options
     */
    GraphQLCodeGenerator.prototype.writeDoc = function (codeWriter, text, options) {
        var i, len, lines, v;
        if (options.gqDoc && _.isString(text)) {
            lines = text.trim().split("\n");
            for (i = 0, len = lines.length; i < len; i++) {
                v = lines[i].trim();
                if (v.length > 0)
                    codeWriter.writeLine("# " + lines[i]);
            }
        }
    };

    GraphQLCodeGenerator.prototype.isUnion = function (elem) {
        return (elem.stereotype !== undefined && elem.stereotype === "union")
    };

    GraphQLCodeGenerator.prototype.isInput = function (elem) {
        return (elem.stereotype !== undefined && elem.stereotype === "input")
    };

    GraphQLCodeGenerator.prototype.isSchema = function (elem) {
        return (elem.stereotype !== undefined && elem.stereotype === "schema")
    };


    /**
     * Collect super classes of a given element
     * @param {type.Model} elem
     * @return {Array.<type.Model>}
     */
    GraphQLCodeGenerator.prototype.getSuperClasses = function (elem) {
        var generalizations = Repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLGeneralization && rel.source === elem);
        });
        return _.map(generalizations, function (gen) {
            return gen.target;
        });
    };

    /**
     * Collect super interfaces of a given element
     * @param {type.Model} elem
     * @return {Array.<type.Model>}
     */
    GraphQLCodeGenerator.prototype.getSuperInterfaces = function (elem) {
        var realizations = Repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLInterfaceRealization && rel.source === elem);
        });
        return _.map(realizations, function (gen) {
            return gen.target;
        });
    };

    /**
     * Generate
     * @param {type.Model} baseModel
     * @param {string} basePath
     * @param {Object} options
     */
    function generate(baseModel, basePath, options) {
        var result = new $.Deferred();
        var codeGenerator = new GraphQLCodeGenerator(baseModel, basePath);
        return codeGenerator.generate(baseModel, basePath, options);
    }

    exports.generate = generate;

});
