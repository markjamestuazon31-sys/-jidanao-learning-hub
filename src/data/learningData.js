import {
Lock,
Play
}
from "lucide-react";


function LearningCard({

title,
type,
subject,
grade,
description,
icon

}){


function handlePlay(){

alert(
"Please login first to access this activity."
);

}



return(

<div className="learning-card">


<div className="learning-icon">

{icon}

</div>


<div className="learning-info">


<span className="tag">

{type}

</span>


<h3>

{title}

</h3>


<p>

{description}

</p>


<div className="details">

<span>
{subject}
</span>


<span>
{grade}
</span>

</div>



<button
onClick={handlePlay}
>


<Lock size={16}/>

Login to Play


</button>



</div>



</div>

)

}


export default LearningCard;