import json

output = {
        "2018": {},
        "2019": {},
        "2020": {}
    };

with open('/Users/ryanefendy/Downloads/history_work.json') as f:
    with open('/Users/ryanefendy/Downloads/history_personal.json') as f2:
        d = json.load(f)
        d2 = json.load(f2)
        
        for year in d['pomodoros']:
            for date in d['pomodoros'][year]:
                if date in output[year]:
                    output[year][date] += d['pomodoros'][year][date]
                else:
                    output[year][date] = d['pomodoros'][year][date]

        for year in d2['pomodoros']:
            for date in d2['pomodoros'][year]:
                if date in output[year]:
                    output[year][date] += d2['pomodoros'][year][date]
                else:
                    output[year][date] = d2['pomodoros'][year][date]

        with open('/Users/ryanefendy/Downloads/history_combined.json', 'w') as outfile:
            json.dump(output, outfile)