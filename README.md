# nestedGrid
A jQuery plugin that let you display nested grid(table)

just start by including this plugin and do something like this in your html:

<div id="test"></div>
$('#test').nestedGrid({
    data:{
  "data": [
    {
      "col1": "data1",
      "col2": "data2",
      "col3": "data3",
    }
  ],
  "fields": ["col1", "col2", "col3"]
}
});

There you go, it works!
