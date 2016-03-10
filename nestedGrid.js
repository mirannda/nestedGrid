//Author: Ribo Mo
(function ($) {
    "use strict";

    var GRID_WIDTH = 200;

    $.fn.nestedGrid = function (options) {
        $.fn.nestedGrid.Options = $.extend($.fn.nestedGrid.defaultOptions, options);
        this.each(function () {
            var $table = $(this);
            setGrid($table, options);
        });
    };

    // Provide default options for plugin
    $.fn.nestedGrid.defaultOptions = {
        ajax: {
            method: "post",
            dataType: "json"
        }
    };

    // Reload the grid
    $.fn.nestedGrid.reloadGrid = function ($container) {
        var data = $container.children().data("data");
        var fields = $container.children().data("fields");
        var tableName = $container.children().data("table");
        var newGrid = new Grid(data, fields, tableName);
        $container.html(newGrid.$grid);
    };

    // Pass in selector and this function will make it a grid!
    var setGrid = function ($table, userSettings) {
        var options = $.fn.nestedGrid.Options;

        // generate from AJAX
        if (!options.data) {
            var request = $.ajax(options.ajax);
            return request.success(function (result) {
                var grid = new Grid(result.data, result.fields, result.tableName);
                $table.html(grid.$grid);
            });
        }
        else {
            var grid = new Grid(userSettings.data, userSettings.fields, userSettings.tableName);
            $table.html(grid.$grid);
        }
    };

    function Grid(data, fields, tableName) {
        this.data = data;
        this.fields = fields;
        this.tableName = tableName;
        this.$grid = null;
        this.init();
    }

    Grid.prototype = {
        init: function () {
            this.$grid = $("<table>");
            this.$grid.append(this.createHeader());
            this.$grid.append(this.createBody());
            this.$grid.on("click", ".text-field", this.editRow);

            this.$grid.addClass("nestedGrid");
            this.$grid.data("table", this.tableName);
            this.$grid.data("data", this.data);
            this.$grid.data("fields", this.fields);
        },

        createHeader: function () {
            var fields = showTopLevelFields(this.fields);
            var $fieldData = [];
            $fieldData.push($("<th>"));
            for (var i = 0; i < fields.length; i++) {
                var $field = $("<th>").append(fields[i]);
                $field.width(GRID_WIDTH);
                $fieldData.push($field);
            }
            $fieldData.push($("<th>").append("action"));
            return $("<thead><tr>").append($fieldData);
        },

        createBody: function () {
            var rows = [];
            for (var i = 0; i < this.data.length; i++) {
                var row = new Row(this.data[i], this.fields, this.$grid);

                // Add Strap
                if (i % 2 == 0) {
                    row.$row.addClass("odd-row");
                } else {
                    row.$row.addClass("even-row");
                }
                rows = rows.concat(rows, row.getRow());
            }
            return $("<tbody>").append(rows);
        },

        // Allow user to edit data in the row
        editRow: function () {
            var removeEditing = function(){
                $(this).find(".text-field").each(function () {
                    var textBox = $(this).find("input");
                    $(this).text(textBox.val());
                    textBox.remove();
                });
                $(this).removeClass("editing");
            };

            var $row = $(this).parent();

            if ($row.hasClass("editing")) {
            } else {
                // If there's another row in editing status, cancel the editing state.
                // Make sure editing row is unique.
                var $grid = $row.parent().parent();
                var $editingRows = $grid.find(".editing");
                if ($editingRows.length !== 0) {
                    $editingRows.each(removeEditing);
                    $("html").off("click");
                }

                // Replace text with input
                $row.find(".text-field").each(function () {
                    if (($(this)).has("input").length === 0) {
                        $row.addClass("editing");
                        var text = $(this).text();
                        var $textBox = $("<input>").attr("type", "text").attr("value", text);
                        $(this).text('').append($textBox);
                    }
                });

                // When user clicked elsewhere, remove editing status.
                $("html").click(function (event) {
                    if (!$(event.target).closest(".nestedGrid").length && !$(event.target).is(".nestedGrid")) {
                        var $that = $(".nestedGrid").find("tr");
                        removeEditing.bind($that)();
                        $("html").off("click");
                    }
                });
            }
        }


    };

    // Constructor for Row
    function Row(data, fields, $grid) {
        this.data = data;
        this.fields = fields;
        this.$grid = $grid;
        this.$row = null;
        this.topLevelFields = null;
        this.$subgrid = null;
        this.init();
    }

    Row.prototype = {
        init: function () {
            this.$row = $("<tr>");
            this.topLevelFields = showTopLevelFields(this.fields);

            var $rowData = [];
            var $subgridTrigger = this.createSubgridTrigger();
            $rowData.push($subgridTrigger);
            $rowData = $rowData.concat(this.createCells());
            $rowData.push(this.createSaveDeleteField());
            this.$row.append($rowData);

            // Event delegation
            this.$row.on("click", ".save-link", this.editEvent().saveClickEvent);
            this.$row.on("click", ".delete-link", this.editEvent().deleteClickEvent);

            // Add subgrid
            if (this.isSubgridExist()) {
                this.$subgrid = this.createSubgrid();
                var that = this;
                this.$row.on("click", ".subgrid-trigger", function () {
                    that.$subgrid.fadeToggle();
                    var $this = $(this);
                    if ($this.hasClass("expand")) {
                        $this.removeClass("expand");
                        $this.addClass("collapse");
                    }
                    else {
                        $this.removeClass("collapse");
                        $this.addClass("expand");
                    }
                });
            }

            this.$row.data("data", this.data);
        },

        //Return $row selector and $subgrid selector
        getRow: function () {
            var result = [];
            result.push(this.$row);
            if (this.$subgrid) {
                result.push(this.$subgrid);
            }
            return result;
        },

        // Add subgrid to existing grid
        createSubgrid: function () {
            var that = this;
            var subgridInfo = function (fields) {
                var result = {
                    fields: [],
                    table: []
                };
                for (var i = 0; i < fields.length; i++) {
                    if (fields[i].indexOf(".") !== -1) {
                        var data = fields[i].split(".");
                        result["fields"].push(data[1]);
                        if (result["table"].indexOf(data[0]) === -1) {
                            result["table"] = data[0];
                        }
                    }
                }
                return result;
            }(this.fields);
            var maxCol = function () {
                var maxCol = 0;
                that.$row.find('td').each(function () {
                    maxCol += 1;
                });
                return maxCol;
            }();
            var subgridData = this.data[this.getSubgridName()[0]];
            var subgrid = new Grid(subgridData, subgridInfo.fields, subgridInfo.table);
            subgrid.$grid.addClass("subgrid");
            var $insertCell = $("<td>").append(subgrid.$grid).attr("colspan", maxCol);
            var $insertRow = $("<tr>").append($insertCell).addClass("collapse");
            $insertRow.hide();
            return $insertRow;
        },

        // Return all the data contain in the fields
        createCells: function () {
            var fields = this.topLevelFields;
            var $result = [];
            for (var i = 0; i < fields.length; i++) {
                var $fieldData = $("<td>").append(this.data[fields[i]]).addClass("text-field");
                $result.push($fieldData);
            }
            return $result;
        },

        // Add trigger
        createSubgridTrigger: function () {
            if (this.isSubgridExist()) {
                var $expand = $("<div>").addClass("subgrid-trigger").addClass("expand").addClass("trigger-placeholder");
                return $("<td>").append($expand);
            }
            else {
                return $("<td>").append($("<div>").addClass("trigger-placeholder"));
            }
        },

        createSaveDeleteField: function () {
            var $editField = $("<td>");
            var $save = $("<a>").append("save").attr("href", "#").addClass("save-link");
            var $delete = $("<a>").append("delete").attr("href", "#").addClass("delete-link");
            $editField.append($save).append(" ").append($delete);
            return $editField;
        },

        // Event Handlers for edit and delete button
        editEvent: function () {
            var that = this;
            var getData = function () {
                var obj = {};
                var i = 0;
                that.$row.find("td.data").each(function () {
                    obj[that.topLevelFields[i]] = $(this).text();
                    i++;
                });
                return obj;
            };
            var getTableName = function () {
                return that.$row.parent().parent().data("table");
            };
            var options = $.fn.nestedGrid.Options;
            return {
                saveClickEvent: function () {
                    var newData = getData();
                    var object = {
                        purpose: "edit",
                        tableName: getTableName(),
                        new: newData,
                        old: that.data
                    };
                    console.log(object.new);
                    console.log(object.old);
                    //Pass data to server
                    $.ajax({
                        method: "post",
                        url: options.ajax.url,
                        dataType: "json",
                        data: JSON.stringify(object)
                    });
                    that.reloadRow();
                },
                deleteClickEvent: function () {
                    var object = {
                        purpose: "delete",
                        tableName: getTableName(),
                        old: that.data
                    };
                    console.log(object.old);
                    that.$row.remove();
                    $.ajax({
                        method: "post",
                        url: options.ajax.url,
                        dataType: "json",
                        data: JSON.stringify(object)
                    });
                    $.fn.nestedGrid.reloadGrid(that.$grid.parent());
                }
            }
        },

        getSubgridName: function () {
            var result = [];
            for (var i = 0; i < this.fields.length; i++) {
                if (this.fields[i].indexOf(".") !== -1) {
                    var data = this.fields[i].split(".");
                    if (result.indexOf(data[0]) === -1) {
                        result.push(data[0]);
                    }
                }
            }
            return result;
        },

        isSubgridExist: function () {
            return this.data[this.getSubgridName()[0]] !== undefined;
        },

        reloadRow: function () {
            var row = new Row(this.data, this.fields, this.$grid);
            this.$row.html(row.$row.html());
            this.$subgrid.html(row.$subgrid.html());
        }
    };


    $.fn.nestedGrid.reloadGrid = function ($container) {
        var data = $container.children().data("data");
        var fields = $container.children().data("fields");
        var tableName = $container.children().data("table");
        var newGrid = new Grid(data, fields, tableName);
        $container.html(newGrid.$grid);
    };

    //Only show fields that are in top level
    function showTopLevelFields(fields) {
        var result = [];
        for (var i = 0; i < fields.length; i++) {
            if (fields[i].indexOf(".") === -1) {
                result.push(fields[i]);
            }
        }
        return result;
    }
}(jQuery));