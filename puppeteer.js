const puppeteer = require("puppeteer");
const data = require("./data.json");

// /fetch("./data.json").then((response) => response.json());
// .then((data) => {});

// let data = "data.json";

const param = data;
console.log(param);

const pdfCreator = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const html = `
<html>
<style>
/* table {
    margin-left: 20px;
    margin-right: 20px;
} */
table, th {
  border: 1px solid black;
  border-collapse: collapse;
  padding: 5px;
}
 td {
    border-collapse: collapse;
    padding: 5px;
    border-left: 1px solid black;
    border-right: 1px solid black;
}
</style>

<body>
<div style="display: flex; width: 100%; justify-content: space-between;">
 <h2>Field Service Report</h2>
 <h2>VERTIV</h2>
</div>

<table style="width:100%; justify-content: center;">
  <tr style="border: 1px solid black;">
    <td colspan="2">
     <div style="display: flex; align-items: center;">
        <h4>FSR Number :</h4>
        <p>${param.fsr_number}</p>
     </div>
    </td>
    <td>
     <div style="display: flex; align-items: center;">
        <h4>FSR Date :</h4>
        <p>${param.completion_date}</p>
     </div>
    </td>
  </tr>
 <tr style="text-align: left;">
    <td>
     <div style="display: flex; align-items: center;">
      <h4>Customer Name :</h4>
      <p>${param.customer_name}</p>
     </div>
   </td>
    <td>
     <div style="display: flex; align-items: center;">
      <h4>Service Type :</h4>
      <p>${param.servicetype}</p>
     </div>
   </td>
    <td>
     <div style="display: flex; align-items: center;">
      <h4>Contract No. :</h4>
      <p>${param.contract_no}</p>
     </div>
   </td>
 </tr>
 <tr style="text-align: left;">
    <td rowspan="4">
     <div style="display: flex; align-items: center;">
      <h4>Address :</h4>
      <p>${param.addressContent}</p>
     </div>
   </td>
    <td>
     <div style="display: flex; align-items: center;">
      <h4>Call Number :</h4>
      <p>${param.call_no}</p>
     </div>
   </td>
    <td>
     <div style="display: flex; align-items: center;">
      <h4>Equipment Status :</h4>
      <p>${param.equipment_status}</p>
     </div>
   </td>
 </tr>
 <tr style="text-align: left;">
    <td>
     <div style="display: flex; align-items: center;">
      <h4>Model :</h4>
      <p>${param.product_model}</p>
     </div>
   </td>
    <td>
     <div style="display: flex; align-items: center;">
      <h4>Service Branch :</h4>
      <p>${param.servicebranch}</p>
     </div>
   </td>
 </tr>
 <tr style="text-align: left;">
    <td>
        <div style="display: flex; align-items: center;">
         <h4>Serial Number :</h4>
         <p>${param.product_serialno}</p>
        </div>
    </td>
    <td>
     <div style="display: flex; align-items: center;">
      <h4>Service Provider :</h4>
      <p>${param.serviceprovider}</p>
     </div>
   </td>
 </tr>
 <tr style="text-align: left;">
    <td>
     <div style="display: flex; align-items: center;">
      <h4>Rating :</h4>
      <p>${param.product_rating}</p>
     </div>
   </td>
    <td>
     <div style="display: flex; align-items: center;">
      <h4>Engineer Name :</h4>
      <p>${param.engineername}</p>
     </div>
   </td>
 </tr>
 <tr style="text-align: left;">
    <td>
     <div style="display: flex; align-items: center;">
      <h4>Contact :</h4>
      <p>${param.contact}</p>
     </div>
   </td>
    <td>
     <div style="display: flex; align-items: center;">
      <h4>Product Group :</h4>
      <p>${param.product_group}</p>
     </div>
   </td>
    <td>
     <div style="display: flex; align-items: center;">
      <h4>Engineer contact No. :</h4>
      <p>${param.call_engineer_mobilenumber}</p>
     </div>
   </td>
 </tr>
</table>

<table style="width: 100%;">
  <tr>
    <td colspan="2">
        <div style="display: flex; align-items: center;">
         <h4>Problem statement :</h4>
         <p>${param.problemstatement}</p>
        </div>
      </td>
      <td colspan="2">
        <div style="display: flex; align-items: center;">
         <h4>Fault Code:</h4>
         <p>${param.faultcode}</p>
        </div>
    </td>
  </tr>
  <tr>
    <th colspan="4" style="text-align: left;">Site Assessment / Safety Risk Assessment :</th>
  </tr>
</table>

<table id="myTable" style="width: 100%;">
    <tr>
        <th>Hazard</th>
        <th>Level of Risk</th>
        <th>Can work proceed safely?</th>
        <th>Detail safety measures put in place?</th> 
    </tr>
</table>

<script>
    // var param = [ 
    //     {hazard: "Work at height", level_of_risk: "Low", can_work_proceed_safely: "Yes", safety_measures_put_in_place: "56"},
    //     {hazard: "Site Induction", level_of_risk: "High", can_work_proceed_safely: "No", safety_measures_put_in_place: "Yes"}
    // ];

    var table = document.getElementById("myTable");

    for (var i = 0; i <param.length; i++) {
        var row = table.insertRow();
        var cell1 = row.insertCell(0);
        var cell2 = row.insertCell(1);
        var cell3 = row.insertCell(2);
        var cell4 = row.insertCell(3);
        cell1.innerHTML = param[i].hazard;
        cell2.innerHTML = param[i].level_of_risk;
        cell3.innerHTML = param[i].can_work_proceed_safely;
        cell4.innerHTML = param[i].safety_measures_put_in_place;
    }
</script>

<table style="width: 100%;">
  <tr style="text-align: left; border: 1px solid black;">
    <td colspan="4">
     <div style="display: flex; align-items: center;">
      <h4>Time Spent :</h4>
      <p>${param.total_time}</p>
    </div>
   </td>
  </tr>
</table>

<table style="width: 100%;">
    <tr style="text-align: left;">
        <td>
         <div style="display: flex; align-items: center;">
          <h4>Travel Start Date/Time :</h4>
          <p>${param.travel_start_time}</p>
         </div>
       </td>
        <td>
         <div style="display: flex; align-items: center;">
          <h4>On Site Time :</h4>
          <p>${param.on_site_time}</p>
         </div>
       </td>
        <td>
         <div style="display: flex; align-items: center;">
          <h4>Equipment Face :</h4>
          <p>${param.equipment_facetime_info}</p>
         </div>
       </td>
    </tr>
    <tr style="text-align: left;">
        <td>
         <div style="display: flex; align-items: center;">
          <h4>Reporting Date/Time :</h4>
          <p>${param.reporting_date}</p>
         </div>
       </td>
        <td>
         <div style="display: flex; align-items: center;">
          <h4>Travel Time :</h4>
          <p>${param.travel_time}</p>
         </div>
       </td>
        <td>
         <div style="display: flex; align-items: center;">
          <h4>Break/Idle Time :</h4>
          <p>${param.break_time}</p>
         </div>
       </td>
    </tr>
    <tr style="text-align: left;">
        <td>
         <div style="display: flex; align-items: center;">
          <h4>Completion Date/Time :</h4>
          <p>${param.completion_date}</p>
         </div>
       </td>
        <td>
         <div style="display: flex; align-items: center;">
          <h4>Number of Visits :</h4>
          <p>${param.visits}</p>
         </div>
       </td>
        <td>
         <div style="display: flex; align-items: center;">
          <h4>Total Time Spent:</h4>
          <p>${param.total_time}</p>
         </div>
       </td>
    </tr>
</table>

<table style="width: 100%;">
    <tr>
      <th colspan="4" style="text-align: left;">Call Activity :</th>
    </tr>
    <tr style="text-align: left;">
        <td>
         <div style="align-items: center;">
          <h4>Observation :</h4>
          <p>${param.workbench}</p>
         </div>
       </td>
    </tr>
    <tr style="text-align: left;">
        <td>
         <div style="align-items: center;">
          <h4>Work Done :</h4>
          <p>${param.workbench}</p>
         </div>
       </td>
    </tr>
    <tr style="text-align: left;">
        <td>
         <div style="align-items: center;">
          <h4>Recommendation :</h4>
          <p>${param.workbench}</p>
         </div>
       </td>
    </tr>
</table>

<table id="myTable2" style="width: 100%;">
    <tr>
      <th colspan="4" style="text-align: left;">Part Returned :</th>
    </tr>
    <tr>
        <th>Sr No</th>
        <th>Part Code</th>
        <th>Description</th>
        <th>Quantity</th>
    </tr>
    <tr>
        <th>${param.consumedPartNo}</th>
        <td>${param.part_code}</td>
        <td>${param.part_description}</td>
        <td>${param.part_qty}</td>
    </tr>
    <tr>
        <th colspan="4" style="text-align: left;">Part Consumed :</th>
    </tr>
      <tr>
          <th>Sr No</th>
          <th>Part Code</th>
          <th>Description</th>
          <th>Quantity</th>
      </tr>
      <tr>
        <th>${param.consumedPartNo}</th>
        <td>${param.part_code}</td>
        <td>${param.part_description}</td>
        <td>${param.part_qty}</td>
      </tr>
</table>

<script>

  var table2 = document.getElementById("myTable2");

  for (var i = 0; i <param.material.length; i++) {
      var row = table.insertRow();
      var cell1 = row.insertCell(0);
      var cell2 = row.insertCell(1);
      var cell3 = row.insertCell(2);
      var cell4 = row.insertCell(3);
      cell1.innerHTML = param.material[i].consumedPartNo;
      cell2.innerHTML = param.material[i].part_code;
      cell3.innerHTML = param.material[i].part_description;
      cell4.innerHTML = param.material[i].part_qty;
   }

</script>

<table style="width: 100%;">
    <tr>
      <th colspan="2" style="text-align: left;">Service Billable :</th>
    </tr>
    <td>
        <div style="align-items: center;">
         <h4>Customer's Comment :</h4>
         <p>${param.comment}</p>
        </div>
    </td>
    <td>
        <div style="align-items: center;">
         <h4>Customer's Signature :</h4>
         <p>${param.signature}</p>
        </div>
    </td>
</table>

<div style="display: flex; background-color: #548fa1; justify-content: space-between; border: 1px solid black;">
    <div>
        <p>For Queries, please contact our Customer Care Center</p>
        <p>T : 1800 209 6070</p>
        <p>Vertiv Energy Private Limited</p>
    </div>
    <div>
      <h2>VERTIV</h2>
      <p>ISO N0. : QS-FM-SER-0-03-00</p>
    </div>
</div>

</body>
</html>
  `;

  await page.setContent(html);
  await page.pdf({
    path: "example.pdf",
    format: "A4",
    printBackgroung: true,
  });

  await browser.close();
};
pdfCreator();
