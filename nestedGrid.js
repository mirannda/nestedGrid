//Author: Ribo Mo
(function ($) {
    var GRID_WIDTH = 200;
    var ajax_setting;

    $.fn.nestedGrid = function(options){
        this.each(function(){
            var $table = $(this);
            ajax_setting = options.ajax;
            //If pass directly through data
            if(options.data !== undefined) {
                var grid = new Grid(options.data, options.fields, options.tableName);
                $table.html(grid.$grid);
            }

            //Pass through AJAX
            else{
                var defaultOptions = {
                    method: "post",
                    success: function(result){
                        var grid = new Grid(result.data, result.fields, result.tableName);
                        $table.html(grid.$grid);
                    },
                };
                var settings = $.extend(defaultOptions, options.ajax);
                $.ajax(settings);
            }
        });
    };

    //Constructor for Row
    function Row(data, fields){
        this.data = data;
        this.fields = fields;
        this.$row = null;
        this.topLevelFields = null;
        this.init();
    }

    Row.prototype = {
        init: function(){
            this.$row = $("<tr>");
            this.topLevelFields = showTopLevelFields(this.fields);
            this.createRow();
        },

        //Return single row in the table
        createRow: function(){
            var $rowData = [];
            var $subgridTrigger = $("<td>");
            if(this.isSubgridExist()){
                $subgridTrigger = this.createSubgridTrigger();
            }

            $rowData.push($subgridTrigger);
            $rowData = $rowData.concat(this.getCellsData());
            $rowData.push(this.createSaveDeleteField());
            this.$row.append($rowData);
        },

        //Return all the data contain in the fields
        getCellsData: function(){
            var fields = this.topLevelFields;
            var $result = [];
            var that = this;
            for(var i=0;i<fields.length;i++){
                var $fieldData = $("<td>").append(this.data[fields[i]]).addClass("data");
                $fieldData.click(this.fieldClickEvent());
                $result.push($fieldData);
            }
            return $result;
        },

        fieldClickEvent: function(){
            //Change normal field to text box which allows user to edit.
            var changeField2TextBox = function changeField2TextBox($field){
                var text = $field.text();
                var $textBox = $("<input>").attr("type", "text").attr("value", text).css("width", "95%");
                $field.text('').append($textBox);
                $field.focusout(function(){
                    var text = $textBox.val();
                    $textBox.parent().text(text);
                    $textBox.remove();
                });
                $textBox.select();
            };
            return function (){
                if (($(this)).has("input").length === 0) {
                    changeField2TextBox($(this));
                }
            };
        },

        createSubgridTrigger: function () {
            var subgridFieldInfo = function(fields){
                var result = {
                    fields: [],
                    table: [],
                };
                for(var i=0;i<fields.length;i++){
                    if(fields[i].indexOf(".") !== -1){
                        var data = fields[i].split(".");
                        result["fields"].push(data[1]);
                        if(result["table"].indexOf(data[0]) === -1){
                            result["table"] = data[0];
                        }
                    }
                }
                return result;
            }(this.fields);
            var subgridData = this.data[this.getSubgridName()[0]];
            var subgrid = new Grid(subgridData, subgridFieldInfo.fields, subgridFieldInfo.table);
            var $expand = $("<a>").append("expand").attr("href", "#").click(this.expandClickEvent(subgrid.$grid.addClass("subgrid")));
            return $("<td>").addClass("subgrid-trigger").append($expand);
        },

        expandClickEvent: function($subgrid) {
            var inserted = false;
            var that = this;
            var $insertRow;
            return function () {
                if (!inserted) {
                    var $insertCell = $("<td>").append($subgrid).attr("colspan", that.getMaxCol());
                    $insertRow = $("<tr>").append($insertCell);
                    that.$row.after($insertRow);
                    inserted = true;
                }
                else {
                    $insertRow.toggle();
                }
            };
        },

        createSaveDeleteField: function(){
            var $editField = $("<td>");
            var that = this;
            var $save = $("<a>").append("save").attr("href","#").click(this.editEvent().saveClickEvent);
            var $delete = $("<a>").append("delete").attr("href","#").click(this.editEvent().deleteClickEvent);
            $editField.append($save).append(" ").append($delete);
            return $editField;
        },

        editEvent: function(){
            var that = this;
            var getData = function(){
                var obj = {};
                var i = 0;
                that.$row.find("td.data").each(function(){
                    obj[that.topLevelFields[i]] = $(this).text();;
                    i++;
                });
                return obj;
            };
            var getTableName = function () {
                return that.$row.parent().parent().data("table");
            };
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
                        url: ajax_setting.url,
                        dataType: "json",
                        data: JSON.stringify(object),
                    });
                },
                deleteClickEvent: function(){
                    var object = {
                        purpose: "delete",
                        tableName: getTableName(),
                        old: rowData,
                    };
                    console.log(object.old);
                    that.$row.remove();
                    $.ajax({
                        method: "post",
                        url: ajax_setting.url,
                        dataType: "json",
                        data: JSON.stringify(object),
                    });
                }
            }
        },

        getMaxCol: function(){
            var maxCol = 0;
            this.$row.find('td').each(function() {
                maxCol += 1;
            });
            return maxCol;
        },

        getSubgridName: function(){
            var result = [];
            for(var i=0;i<this.fields.length;i++){
                if(this.fields[i].indexOf(".") !== -1){
                    var data = this.fields[i].split(".");
                    if(result.indexOf(data[0]) === -1){
                        result.push(data[0]);
                    }
                }
            }
            return result;
        },

        isSubgridExist: function(){
            return this.data[this.getSubgridName()[0]] !== undefined;
        },
    };

    function Grid(data, fields, tableName){
        this.data = data;
        this.fields = fields;
        this.tableName = tableName;
        this.$grid = null;
        this.init();
    }

    Grid.prototype = {
        init: function(){
            this.$grid = this.createGrid();
        },

        createGrid: function(){
            var $html = $("<table>");
            var $header = this.createHeader();
            var $body = this.createBody();
            $html.append($header);
            $html.append($body);
            $html.data("table", this.tableName);
            return $html;
        },

        createHeader: function(fields){
            fields = showTopLevelFields(this.fields);
            var $fieldData = [];
            $fieldData.push($("<th>").append("Show More"));
            for(var i=0;i<fields.length;i++){
                var $field = $("<th>").append(fields[i]);
                $field.width(GRID_WIDTH);
                $fieldData.push($field);
            }
            $fieldData.push($("<th>").append("action"));
            return $("<thead><tr>").append($fieldData);
        },

        createBody: function(){
            var $rows = [];
            for(var i=0;i<this.data.length;i++){
                var row = new Row(this.data[i], this.fields);
                $rows.push(row.$row);
            }
            return $("<tbody>").append($rows);
        },
    };

    //Only show fields that are in top level
    function showTopLevelFields(fields){
        var result = [];
        for(var i=0;i<fields.length;i++){
            if(fields[i].indexOf(".") === -1){
                result.push(fields[i]);
            }
        }
        return result;
    }
}(jQuery));