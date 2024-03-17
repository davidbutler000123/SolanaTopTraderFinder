import React, { useEffect, useState } from "react";
const ExcelJS = require("exceljs");

const toDataURL = (url) => {
  const promise = new Promise((resolve, reject) => {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
      var reader = new FileReader();
      reader.readAsDataURL(xhr.response);
      reader.onloadend = function () {
        resolve({ base64Url: reader.result });
      };
    };
    xhr.open("GET", url);
    xhr.responseType = "blob";
    xhr.send();
  });

  return promise;
};

const App = () => {
  const [data, setData] = useState([]);
  const [rankSize, setRankSize] = useState(10);

  useEffect(() => {
    fetch("https://shadowwizards.org/raydium/api/wallets?rankSize=" + rankSize)
      .then((res) => res.json())
      .then(async (data) => {
        console.log(data);
        setData(data);
      })
      .then((json) => console.log(json));
  }, [rankSize]);

  const exportExcelFile = () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("My Sheet");
    // sheet.properties.defaultRowHeight = 80;

    // sheet.getRow(1).border = {
    //   top: { style: "thick", color: { argb: "FFFF0000" } },
    //   left: { style: "thick", color: { argb: "000000FF" } },
    //   bottom: { style: "thick", color: { argb: "F08080" } },
    //   right: { style: "thick", color: { argb: "FF00FF00" } },
    // };

    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "darkVertical",
      fgColor: { argb: "FFFF00" },
    };

    sheet.getRow(1).font = {
      name: "Comic Sans MS",
      family: 4,
      bold: true,
    };

    sheet.columns = [
      {
        header: "Wallet",
        key: "wallet",
        width: 20,
      },
      {
        header: "Ranking",
        key: "ranking",
        width: 10
      },
      {
        header: "Solscan Link",
        key: "solScan",
        width: 20,
      },
      {
        header: "Avg Profit(SOL)",
        key: "avgProfit",
        width: 15,
      },
      {
        header: "Total Profit(SOL)",
        key: "totalProfit",
        width: 15,
      },
      {
        header: "Profitable Trades#",
        key: "profitableTrades",
        width: 10,
      },
      {
        header: "Total Trades#",
        key: "totalTrades",
        width: 10,
      },
      {
        header: "Trade Score%",
        key: "tradeScore",
        width: 15,
      },
      {
        header: "Traded Token Names",
        key: "tradedTokens",
        width: 30,
      }
    ];

    const promise = Promise.all(
      data?.map(async (trader, index) => {
        const rowNumber = index + 1;
        sheet.addRow({
          wallet: trader?.wallet,
          ranking: trader?.ranking,
          solScan: trader?.solScan,
          avgProfit: trader?.avgProfit.toFixed(2),
          totalProfit: trader?.totalProfit.toFixed(2),
          profitableTrades: trader?.profitableTrades,
          totalTrades: trader?.totalTrades,
          tradeScore: trader?.tradeScore,
          tradedTokens: trader?.tradedTokens,
        });
      })
    );

    promise.then(() => {
      // const priceCol = sheet.getColumn(5);

      // // iterate over all current cells in this column
      // priceCol.eachCell((cell) => {
      //   const cellValue = sheet.getCell(cell?.address).value;
      //   // add a condition to set styling
      //   if (cellValue > 50 && cellValue < 1000) {
      //     sheet.getCell(cell?.address).fill = {
      //       type: "pattern",
      //       pattern: "solid",
      //       fgColor: { argb: "FF0000" },
      //     };
      //   }
      // });

      workbook.xlsx.writeBuffer().then(function (data) {
        const blob = new Blob([data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "download.xlsx";
        anchor.click();
        window.URL.revokeObjectURL(url);
      });
    });
  };

  const onSelRankSize = (e) => {
    setRankSize(e.target.value)
  }

  return (
    <div style={{ padding: "30px" }}>
      <div style={{display:"flex", flexDirection:"row", justifyContent:"space-between", alignItems:"flex-end"}}>
        <div>
          <h3>Raydium Top Trader Ranking:</h3>
        </div>
        <div style={{display:"flex", flexDirection:"row", gap:"20px"}}>
          <select name="rank_size" id="rank_size" className="btn mt-2 mb-2 pr-2"
            onChange={onSelRankSize}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
          <button
            className="btn btn-primary mt-2 mb-2"
            onClick={exportExcelFile}
          >
            Export
          </button>
        </div>
      </div>
      <table className="table table-bordered">
        <thead style={{ background: "yellow" }}>
          <tr>
            <th scope="col">Wallet</th>
            <th scope="col">Ranking</th>
            <th scope="col">Solscan Link</th>
            <th scope="col">Avg Profit(SOL)</th>
            <th scope="col">Total Profit(SOL)</th>
            <th scope="col">Pofitable Trades#</th>
            <th scope="col">Total Trades#</th>
            <th scope="col">Trade Score%</th>
            <th scope="col">Traded Token Names</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(data) &&
            data?.map((row) => (
              <tr>
                <td>{row?.wallet}</td>
                <td>{row?.ranking}</td>
                <td><a href={row?.solScan}>{row?.solScan}</a></td>
                <td>{row?.avgProfit.toFixed(2)}</td>
                <td>{row?.totalProfit.toFixed(2)}</td>
                <td>{row?.profitableTrades}</td>
                <td>{row?.totalTrades}</td>
                <td>{row?.tradeScore}</td>
                <td>{row?.tradedTokens}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};

export default App;
