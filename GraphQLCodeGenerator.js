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
    function GraphQLCodeGenerator(baseModel) {

        /** @member {type.Model} */
        this.baseModel = baseModel;
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

        if (options.debug)
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

        if (options.debug)
            console.log("Saving to " + path);

        var file = FileSystem.getFileForPath(path);
        FileUtils.writeText(file, codeWriter.getData(), true).then(result.resolve, result.reject);

        return result.promise();
    };

    GraphQLCodeGenerator.prototype.recurGenerate = function (codeWriter, elem, options) {

        var self = this, oe;

        // Package

        if (elem instanceof type.UMLPackage || elem instanceof type.Project) {

            oe = elem.ownedElements;
            if (oe) {
                for (var i = 0, len = oe.length; i < len; i++) {
                    var e = oe[i];
                    self.recurGenerate(codeWriter, e, options);
                }
            }

        } else if (elem instanceof type.UMLClass) {

            if (elem.isAbstract === false) {
                // Class
                if (options.debug)
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
            }
        } else if (elem instanceof type.UMLPrimitiveType) {
            // Scalar
            if (options.debug)
                console.log('Scalar generate' + elem.name);
            this.writeScalar(codeWriter, elem, options);
            codeWriter.writeLine();
        } else if (elem instanceof type.UMLInterface) {
            // Interface
            if (options.debug)
                console.log('Interface generate' + elem.name);
            this.writeInterface(codeWriter, elem, options);
            codeWriter.writeLine();
        } else if (elem instanceof type.UMLEnumeration) {
            // Enum
            if (options.debug)
                console.log('Enumeration generate' + elem.name);
            this.writeEnum(codeWriter, elem, options);
            codeWriter.writeLine();
        } else {
            // Others (Nothing generated.)
            if (options.debug)
                console.log('nothing generate ' + elem);
        }

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

        // holds {attrName:String -> attrValue:String}
        // doc is modeled as attrName.doc
        var attrDefs = {};

        // Member Variables
        this.recurWriteInterfaceAttributes2(attrDefs, elem, options);


        // render attrDef to codeWriter
        for (var attr in attrDefs) {

            // ignore comments which are coming a "attrname.doc"
            if (attr.indexOf(".") <= 0) {
                var doc = attrDefs[attr + ".doc"];
                if (doc)
                    this.writeDoc(codeWriter, doc, options);

                codeWriter.writeLine(attr + attrDefs[attr]);
            }
        }

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

            if (_extends[0].isAbstract === false) {
                // can graphQL support more than one parent?
                terms.push("extends " + _extends[0].name);
            }
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

        // holds {attrName:String -> attrValue:String}
        // doc is modeled as attrName.doc
        var attrDefs = {};

        // recursive interface attributes
        for (i = 0, len = _implements.length; i < len; i++) {
            this.recurWriteInterfaceAttributes2(attrDefs, _implements[i], options);
        }

        // recursive class attributes
        this.recurWriteClassAttributes2(attrDefs, elem, options);

        // render attrDef to codeWriter
        for (var attr in attrDefs) {

            // ignore comments which are coming a "attrname.doc"
            if (attr.indexOf(".") <= 0) {
                var doc = attrDefs[attr + ".doc"];
                if (doc)
                    this.writeDoc(codeWriter, doc, options);

                codeWriter.writeLine(attr + attrDefs[attr]);
            }
        }

        // mutators
        for (i = 0, len = elem.operations.length; i < len; i++) {
            this.writeMutator(codeWriter, elem.operations[i], options);
            codeWriter.writeLine();
        }

        codeWriter.outdent();
        codeWriter.writeLine("}");
    };

    GraphQLCodeGenerator.prototype.recurWriteInterfaceAttributes2 = function (attrDefs, elem, options) {

        var i, len;

        // from parent interfaces
        var _extends = this.getSuperClasses(elem);
        for (i = 0, len = _extends.length; i < len; i++)
            this.recurWriteClassAttributes2(attrDefs, _extends[i], options);

        // Member Variables
        // (from attributes)
        for (i = 0, len = elem.attributes.length; i < len; i++)
            this.writeAttribute2(attrDefs, elem.attributes[i], options);

        // (from associations)
        var associations = Repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLAssociation);
        });
        for (i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i];
            if (asso.end2.reference === elem && asso.end1.navigable === true)
                this.writeAttribute2(attrDefs, asso.end1, options);

            if (asso.end1.reference === elem && asso.end2.navigable === true)
                this.writeAttribute2(attrDefs, asso.end2, options);

        }
    };

    GraphQLCodeGenerator.prototype.recurWriteClassAttributes2 = function (attrDefs, elem, options) {
        var i, len;

        var _extends = this.getSuperClasses(elem);
        if (_extends.length > 0) {
            this.recurWriteClassAttributes2(attrDefs, _extends[0], options);
        }

        // attributes
        for (i = 0, len = elem.attributes.length; i < len; i++) {
            this.writeAttribute2(attrDefs, elem.attributes[i], options);
        }

        // (from associations)
        var associations = Repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLAssociation);
        });

        if (options.debug)
            console.log('association length: ' + associations.length);
        for (i = 0, len = associations.length; i < len; i++) {

            var asso = associations[i];
            if (asso.end2.reference === elem && asso.end1.navigable === true) {
                this.writeAttribute2(attrDefs, asso.end1, options);
            }
            if (asso.end1.reference === elem && asso.end2.navigable === true) {
                this.writeAttribute2(attrDefs, asso.end2, options);
            }
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

        if (options.debug)
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

                // initial value
                if (p.defaultValue && p.defaultValue.length > 0) {
                    s = s + "=" + p.defaultValue;
                }

                paramTerms.push(s);
            }

            terms.push(elem.name + "(" + paramTerms.join(", ") + ")");

            // return type
            if (returnParam) {
                terms.push(":");
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

        // | Cardinality property| => Generation |
        // | ------------------- |--------------|
        // |       0..1          |        field |
        // |       1             |       field! |
        // |       n   n>1       |     [field!] |
        // |       0..* or *     |      [field] |
        // |       1..*          |     [field!] |

        if (elem.multiplicity) {
            var m = elem.multiplicity.trim();
            if (_.contains(["0..1"], m)) {
                _type = _type;
            }
            else if (_.contains(["1"], m)) {
                _type = _type + "!";
            }
            else if (m.match(/^\d+$/)) {
                // number
                _type = "[" + _type + "!]";
            }
            else if (_.contains(["0..*", "*"], m)) {
                _type = "[" + _type + "]";
            }
            else if (_.contains(["1..*"], m)) {
                _type = "[" + _type + "!]";
            }
            else {
                console.log("WARNING: We have a problem Houston: unknown cardinality" + _type);
            }
        }

        return _type;
    };


    /**
     * Write type attribute
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    GraphQLCodeGenerator.prototype.writeAttribute2 = function (attrDefs, elem, options) {

        var i, len;


        if (options.debug)
            console.log('writeAttribute', 'elem', elem);

        var name = elem.name;

        // if it's an association, try to guess the name
        if (name.length === 0 && elem instanceof type.UMLAssociationEnd) {
            name = elem._parent.name;
            if (name.length === 0) {
                // if neither the edge nor the relation has a name, make up a name based on the classname
                // use multiplicity as pluralizer
                name = elem.reference.name;
                if (elem.multiplicity) {
                    if (_.contains(["0", "1", "0..1"], elem.multiplicity.trim())) {
                        name = this.pluralize(name, true);
                    } else
                        name = this.pluralize(name);
                } else {
                    name = this.pluralize(name, true);
                }

                // minimize first latter
                name = name.charAt(0).toLowerCase() + name.slice(1);
            }
        }

        if (name.length > 0) {
            var terms = [];
            // doc
            //this.writeDoc(attrDefs, elem.documentation, options);
            attrDefs[name + ".doc"] = elem.documentation;

            // name
            //terms.push(name);
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
            attrDefs[name] = terms.join("");
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
        return (elem.stereotype === "union")
    };

    GraphQLCodeGenerator.prototype.isInput = function (elem) {
        return (elem.stereotype === "input")
    };

    GraphQLCodeGenerator.prototype.isSchema = function (elem) {
        return (elem.stereotype === "schema")
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


    GraphQLCodeGenerator.prototype.pluralize = function (str, revert) {

        var plural = {
            '(quiz)$': "$1zes",
            '^(ox)$': "$1en",
            '([m|l])ouse$': "$1ice",
            '(matr|vert|ind)ix|ex$': "$1ices",
            '(x|ch|ss|sh)$': "$1es",
            '([^aeiouy]|qu)y$': "$1ies",
            '(hive)$': "$1s",
            '(?:([^f])fe|([lr])f)$': "$1$2ves",
            '(shea|lea|loa|thie)f$': "$1ves",
            'sis$': "ses",
            '([ti])um$': "$1a",
            '(tomat|potat|ech|her|vet)o$': "$1oes",
            '(bu)s$': "$1ses",
            '(alias)$': "$1es",
            '(octop)us$': "$1i",
            '(ax|test)is$': "$1es",
            '(us)$': "$1es",
            '([^s]+)$': "$1s"
        };

        var singular = {
            '(quiz)zes$': "$1",
            '(matr)ices$': "$1ix",
            '(vert|ind)ices$': "$1ex",
            '^(ox)en$': "$1",
            '(alias)es$': "$1",
            '(octop|vir)i$': "$1us",
            '(cris|ax|test)es$': "$1is",
            '(shoe)s$': "$1",
            '(o)es$': "$1",
            '(bus)es$': "$1",
            '([m|l])ice$': "$1ouse",
            '(x|ch|ss|sh)es$': "$1",
            '(m)ovies$': "$1ovie",
            '(s)eries$': "$1eries",
            '([^aeiouy]|qu)ies$': "$1y",
            '([lr])ves$': "$1f",
            '(tive)s$': "$1",
            '(hive)s$': "$1",
            '(li|wi|kni)ves$': "$1fe",
            '(shea|loa|lea|thie)ves$': "$1f",
            '(^analy)ses$': "$1sis",
            '((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)ses$': "$1$2sis",
            '([ti])a$': "$1um",
            '(n)ews$': "$1ews",
            '(h|bl)ouses$': "$1ouse",
            '(corpse)s$': "$1",
            '(us)es$': "$1",
            's$': ""
        };

        var irregular = {
            'move': 'moves',
            'foot': 'feet',
            'goose': 'geese',
            'sex': 'sexes',
            'child': 'children',
            'man': 'men',
            'tooth': 'teeth',
            'person': 'people'
        };

        var uncountable = [
            'sheep',
            'fish',
            'deer',
            'series',
            'species',
            'money',
            'rice',
            'information',
            'equipment'
        ];

        // save some time in the case that singular and plural are the same
        if (uncountable.indexOf(str.toLowerCase()) >= 0)
            return str;

        // check for irregular forms
        for (var word in irregular) {

            if (revert) {
                var pattern = new RegExp(irregular[word] + '$', 'i');
                var replace = word;
            } else {
                var pattern = new RegExp(word + '$', 'i');
                var replace = irregular[word];
            }
            if (pattern.test(this))
                return str.replace(pattern, replace);
        }

        if (revert) var array = singular;
        else  var array = plural;

        // check for matches using regular expressions
        for (var reg in array) {
            var pattern = new RegExp(reg, 'i');
            if (pattern.test(this))
                return str.replace(pattern, array[reg]);
        }

        return str;
    };

    /**
     * Generate
     * @param {type.Model} baseModel
     * @param {string} basePath
     * @param {Object} options
     */
    function generate(baseModel, basePath, options) {
        var codeGenerator = new GraphQLCodeGenerator(baseModel);
        return codeGenerator.generate(baseModel, basePath, options);
    }

    function generateString(elem, options) {

        var codeGenerator = new GraphQLCodeGenerator(elem);
        if (options.debug) {
            console.log("generateString " + elem);
            console.log("options " + options);
        }
        var codeWriter = new CodeGenUtils.CodeWriter(codeGenerator.getIndentString(options));
        if (options.debug)
            console.log("codeWriter " + codeWriter);
        codeGenerator.recurGenerate(codeWriter, elem, options);
        if (options.debug)
            console.log("recurGenerate " + codeWriter);
        return codeWriter.getData();
    }

    exports.generate = generate;
    exports.generateString = generateString;
});
