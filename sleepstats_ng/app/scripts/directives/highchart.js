'use strict';

function generateChartData(title, categories, count, yTick, toolTipFormatter) {
  return {
    chart: {
      renderTo:'container',
      defaultSeriesType:'column',
      backgroundColor:'#eee',
      borderWidth:1,
      borderColor:'#ccc',
      plotBackgroundColor:'#fff',
      plotBorderWidth:1,
      plotBorderColor:'#ccc'
    },
    credits:{enabled:false},
    exporting:{enabled:false},
    title:{text:title},
    legend:{
      //enabled:false
    },
    tooltip:{
      borderWidth:1,
      formatter: toolTipFormatter
    },
    plotOptions:{
      column:{
        shadow:false,
        borderWidth:0.5,
        borderColor: 'rgba(76,191,191,1)',
        pointPadding:0,
        groupPadding:0,
        color: 'rgba(76,191,191,.65)',
        animation: false
      },
      spline:{
        shadow:false,
        marker:{
          radius:1
        }
      },
      areaspline:{
        color: 'rgba(76,191,191,1)',
        fillColor: 'rgba(76,191,191,.65)',
        shadow:false,
        marker:{
          radius:1
        }
      }
    },
    xAxis:{
      categories: categories,
      labels:{
        rotation:-90,
        y:40,
        style: {
          fontSize:'8px',
          fontWeight:'normal',
          color:'#333'
        },
      },
      lineWidth:0,
      lineColor:'#999',
      tickLength:70,
      tickColor:'#ccc',
    },
    yAxis:{
      title:{text:''},
      //maxPadding:0,
      gridLineColor:'#e9e9e9',
      tickWidth:1,
      tickLength:3,
      tickColor:'#ccc',
      lineColor:'#ccc',
      tickInterval:yTick,
      //endOnTick:false,
    },
    series: [{
      name:'Bins',
      data: count,
    },{
      name:'Curve',
      type:'spline',
      visible:false,
      data: count,
      //color: 'rgba(204,204,255,.85)'
    },{
      name:'Filled Curve',
      type:'areaspline',
      visible:false,
      data: count,
      //color: 'rgba(204,204,255,.85)'
    }]
  };
}

function timeSeriesToDistribution(timeSeriesArray, categorySize) {
  // sheer # of vars makes this smell fishy...
  var grouped,
    categories,
    counts,
    min,
    max,
    buckets,
    spread,
    numCategories,
    i,
    j,
    lowEnd,
    highEnd,
    key;

  grouped = _.groupBy(timeSeriesArray, function(item) {
    return item.value;
  });

  // sort low to high
  grouped = _.sortBy(grouped, function(group){
    return parseInt(group[0].value, 10);
  });

  categories = _.map(grouped, function(group) {
    // note there might be more than one element in the group array...
    // but we just choose the first b/c it will always be there
    return parseInt(group[0].value, 10);
  });
  counts = _.map(grouped, function(group) {
    return group.length;
  });

  /*  TODO:
    if categorySize < 1 return Error
    if categorySize === 1,
        then do "2", "3", "4" instead of "2-2", "3-3", "4-4"
  */

  min = _.min(categories);
  max = _.max(categories);

  // create buckets
  // will be something like {'3-7': 8}, {'8-12': 14}, {'13-17': 39}, etc...
  buckets = {};

  spread = max - min;
  numCategories = (spread / categorySize) < 1 ?
                  1 : Math.floor((max - min) / categorySize) + 1;

  // init each bucket, eg. "0-4", "5-9"
  for (i = 0; i < numCategories; i++) {
    lowEnd = min + (categorySize * i);
    highEnd = lowEnd + categorySize - 1;
    key = lowEnd + '-' + highEnd;
    buckets[key] = 0;

    // then add stuff to bucket, accumulating values
    for (j = 0; j < categories.length; j++) {
      if (categories[j] >= lowEnd && categories[j] <= highEnd) {
        buckets[key] += counts[j];
      }
    }
  }

  // sort low to high
  buckets = _.sortBy(_.pairs(buckets), function(pair) {
    return parseInt(pair[0].match(/^(\d+)-/)[1], 10);
  });

  categories = _.map(buckets, function(bucket) {return bucket[0];});

  counts = _.map(buckets, function(bucket) {return bucket[1];});

  return [categories, counts];
}

function minutesToHours(mins) {
  var hrs;

  hrs = (parseInt(mins, 10) / 60);
  hrs = Math.round(hrs * 10) / 10;

  return hrs;
}

function showChart(chart, element, rawData, title, bucketSize, formatter) {
  var chartData,
    distributionData,
    categories,
    counts;

  distributionData = timeSeriesToDistribution(rawData, bucketSize);
  categories = distributionData[0];
  counts = distributionData[1];

  // change from "357-386" (mins) to "6-6.4" (hrs)
  if (formatter.units === 'Hours') {
    categories = _.map(categories, function(c) {
      var range,
          n1,
          n2,
          category;

      range = /(\d*)-(\d*)/.exec(c);
      n1 = minutesToHours(range[1]);
      n2 = minutesToHours(range[2]);
      category = n1 + ' - ' + n2;

      return category;
    });
  }

  chartData = generateChartData(
    title,
    categories,
    counts,
    1,
    formatter
  );

  $(element).highcharts(chartData);
}

angular.module('sleepstatsApp')
  .directive('highchart', function () {
    return {
      template: '<div></div>',
      restrict: 'A',
      link: function postLink(scope, element, attrs) {
        var rawData,
            toolTipFormatter;

        toolTipFormatter = function(units) {
          return '<b>' + units + ':</b><br/> ' + this.x + '<br/>' +
                 '<b>Count:</b> ' + this.y;
        };

        // curry with units, b/c we have to give highcharts a function for the
        // tooltip, and we want it to be dynamic
        toolTipFormatter = _.partial(toolTipFormatter, attrs.units);
        toolTipFormatter.units = attrs.units;

        rawData = scope[attrs.highchart];
        if (rawData) {

          // remove stats with zero as a value, like sleeping for 0 hours...
          // that really means you didn't track that day
          if (attrs.nozeros === 'true') {
            rawData = _.reject(rawData, function(obj) {
              return obj.value === '0';
            });
          }

          showChart(
            attrs.highchart,
            element,
            rawData,
            attrs.title,
            parseInt(attrs.bucketsize, 10),
            toolTipFormatter
          );
        }
      }
    };
  });

// var timesAwoken,
//     minutesTillSleep;

// timesAwoken = {"sleep-awakeningsCount":[{"dateTime":"2013-05-04","value":"11"}, {"dateTime":"2013-05-05","value":"29"}, {"dateTime":"2013-05-06","value":"22"}, {"dateTime":"2013-05-07","value":"15"}, {"dateTime":"2013-05-08","value":"13"},{"dateTime":"2013-05-09","value":"4"},{"dateTime":"2013-05-10","value":"15"},{"dateTime":"2013-05-11","value":"40"},{"dateTime":"2013-05-12","value":"14"},{"dateTime":"2013-05-13","value":"16"},{"dateTime":"2013-05-14","value":"13"},{"dateTime":"2013-05-15","value":"0"},{"dateTime":"2013-05-16","value":"9"},{"dateTime":"2013-05-17","value":"17"},{"dateTime":"2013-05-18","value":"16"},{"dateTime":"2013-05-19","value":"40"},{"dateTime":"2013-05-20","value":"0"},{"dateTime":"2013-05-21","value":"16"},{"dateTime":"2013-05-22","value":"12"},{"dateTime":"2013-05-23","value":"25"},{"dateTime":"2013-05-24","value":"16"}]};
// minutesTillSleep = {"sleep-minutesToFallAsleep":[{"dateTime":"2013-05-04","value":"22"},{"dateTime":"2013-05-05","value":"32"},{"dateTime":"2013-05-06","value":"16"},{"dateTime":"2013-05-07","value":"26"},{"dateTime":"2013-05-08","value":"7"},{"dateTime":"2013-05-09","value":"7"},{"dateTime":"2013-05-10","value":"7"},{"dateTime":"2013-05-11","value":"5"},{"dateTime":"2013-05-12","value":"34"},{"dateTime":"2013-05-13","value":"10"},{"dateTime":"2013-05-14","value":"28"},{"dateTime":"2013-05-15","value":"0"},{"dateTime":"2013-05-16","value":"8"},{"dateTime":"2013-05-17","value":"8"},{"dateTime":"2013-05-18","value":"13"},{"dateTime":"2013-05-19","value":"28"},{"dateTime":"2013-05-20","value":"0"},{"dateTime":"2013-05-21","value":"6"},{"dateTime":"2013-05-22","value":"18"},{"dateTime":"2013-05-23","value":"7"},{"dateTime":"2013-05-24","value":"30"}]};

